import re
import unicodedata

# cleans user query before sending to llm for inference
def _clean(query: str) -> str:
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