"""Fan-out of live agent events to WebSocket subscribers, per chat session.

Every event is also appended to a capped Redis list so a client that reconnects
mid-run can replay what it missed (see redis_service.append_agent_event).
"""

import asyncio
import time
from collections import defaultdict
from typing import Any

from pydantic import UUID4

from services.redis_service import redis_service

# Per-subscriber queue size. A slow client drops old events instead of
# making the agent wait on it.
_QUEUE_SIZE = 100


class StreamHub:
	def __init__(self) -> None:
		self._subscribers: dict[str, set[asyncio.Queue]] = defaultdict(set)

	def subscribe(self, session_id: UUID4) -> asyncio.Queue:
		queue: asyncio.Queue = asyncio.Queue(maxsize=_QUEUE_SIZE)
		self._subscribers[str(session_id)].add(queue)
		return queue

	def unsubscribe(self, session_id: UUID4, queue: asyncio.Queue) -> None:
		subs = self._subscribers.get(str(session_id))
		if not subs:
			return
		subs.discard(queue)
		if not subs:
			self._subscribers.pop(str(session_id), None)

	def subscriber_count(self, session_id: UUID4) -> int:
		return len(self._subscribers.get(str(session_id), ()))

	async def publish(self, session_id: UUID4, event_type: str, **data: Any) -> dict:
		event = {"type": event_type, "ts": time.time(), **data}
		try:
			await redis_service.append_agent_event(session_id, event)
		except Exception as exc:  # persistence is best-effort; never break the agent run
			print(f"Warning: could not persist agent event ({exc}).")

		for queue in list(self._subscribers.get(str(session_id), ())):
			if queue.full():
				try:
					queue.get_nowait()
				except asyncio.QueueEmpty:
					pass
			queue.put_nowait(event)
		return event


stream_hub = StreamHub()
