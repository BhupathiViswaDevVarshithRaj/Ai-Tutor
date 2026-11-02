import re
from typing import Annotated, Generic, Literal, TypeVar

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, StringConstraints

LanguageCode = Literal["en", "hi", "te", "ta", "pa", "bn"]


def _password_policy(value: str) -> str:
    # Keep in sync with frontend/src/lib/validation.ts
    if not re.search(r"[A-Za-z]", value) or not re.search(r"\d", value):
        raise ValueError("Password must include at least one letter and one number")
    return value


NewPassword = Annotated[str, Field(min_length=8, max_length=128), AfterValidator(_password_policy)]

TrimmedStr = Annotated[str, StringConstraints(strip_whitespace=True)]


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


T = TypeVar("T")


class Page(BaseModel, Generic[T]):  # noqa: UP046 - PEP 695 syntax needs Python 3.12
    items: list[T]
    total: int
    limit: int
    offset: int
