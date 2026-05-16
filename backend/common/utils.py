import re
import unicodedata

# cleans user query before sending to llm for inference
class Clean:
    def __init__(self, query: str):
        self.original = query
        self.cleaned = self._clean(query)

    def _clean(self, query: str) -> str:
        if not query:
            return ""

        #Standardize weird unicode chars
        query = unicodedata.normalize("NFKC", query)

        # Lowercase
        query = query.lower()

        # Remove URLs
        query = re.sub(r"http\S+|www\S+", "", query)

        # Remove emails
        query = re.sub(r"\S+@\S+", "", query)

        # Remove all punchuation
        query = re.sub(r"[^\w\s]", " ", query)

        # Collapse whitespace
        query = re.sub(r"\s+", " ", query).strip()

        return query

    def get(self) -> str:
        return self.cleaned

    def __str__(self):
        return self.cleaned