"""Models package — import all models so SQLAlchemy registers them."""

from app.models.organization import Organization  # noqa: F401
from app.models.user import User  # noqa: F401
from app.models.missing_person import MissingPerson  # noqa: F401
from app.models.found_person import FoundPerson  # noqa: F401
from app.models.match import Match  # noqa: F401
from app.models.case_update import CaseUpdate  # noqa: F401
from app.models.audit import AuditLog  # noqa: F401
from app.models.notification import Notification  # noqa: F401
from app.models.sighting import Sighting  # noqa: F401
