from dataclasses import dataclass
from typing import Dict, Any
from tools.mcp_client import MCPClient
from observability.telemetry import Telemetry

@dataclass
class ReceiptTool:
    base_url: str
    telemetry: Telemetry

    def __post_init__(self):
        self.client = MCPClient(self.base_url)

    def upload_receipt(self, receipt_data: Dict[str, Any]):
        self.telemetry.event("tool.receipt.upload", {})
        return self.client.post("import/csv", json_body=receipt_data)
