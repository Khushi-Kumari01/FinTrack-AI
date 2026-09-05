import yaml
from dataclasses import dataclass
from tools.mcp_client import MCPClient
from observability.telemetry import Telemetry

@dataclass
class OpenAPITool:
    openapi_path: str
    base_url: str
    telemetry: Telemetry

    def __post_init__(self):
        self.client = MCPClient(self.base_url)

    def load_spec(self):
        with open(self.openapi_path, "r") as f:
            return yaml.safe_load(f)

    def call(self, operation: str):
        self.telemetry.event("tool.openapi.call", {"operation": operation})
        spec = self.load_spec()

        path = spec["paths"][operation]["get"]["operationId"]
        return self.client.get(path)
