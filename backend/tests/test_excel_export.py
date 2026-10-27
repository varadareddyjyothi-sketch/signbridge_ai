"""
Backend API Tests - Excel Export & Formula Injection Prevention
"""

import io
import pytest
import uuid
import openpyxl
from httpx import AsyncClient, ASGITransport
from backend.app.main import app
from backend.app.services.excel_export_service import sanitize_excel_value


def test_formula_injection_sanitization():
    """Verify that potentially hazardous formula injection prefixes are safely escaped with a single quote."""
    assert sanitize_excel_value("=1+1") == "'=1+1"
    assert sanitize_excel_value("+cmd|'/c calc'!A1") == "'+cmd|'/c calc'!A1"
    assert sanitize_excel_value("-5*10") == "'-5*10"
    assert sanitize_excel_value("@SUM(A1:A10)") == "'@SUM(A1:A10)"
    assert sanitize_excel_value("\tTAB_INJECT") == "'\tTAB_INJECT"
    assert sanitize_excel_value("Safe string") == "Safe string"
    assert sanitize_excel_value(123) == 123
    assert sanitize_excel_value(None) == ""


@pytest.mark.anyio
async def test_excel_export_endpoints():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        email = f"excel_user_{uuid.uuid4().hex[:8]}@example.com"
        res_reg = await ac.post("/auth/register", json={
            "email": email,
            "password": "Password123!",
            "display_name": "Excel Tester",
            "preferred_language": "te"
        })
        token = res_reg.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Test empty export
        res_export_empty = await ac.get("/history/export/excel", headers=headers)
        assert res_export_empty.status_code == 200
        assert "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" in res_export_empty.headers.get("content-type", "")
        
        # Parse workbook
        wb_empty = openpyxl.load_workbook(filename=io.BytesIO(res_export_empty.content))
        assert "User Profile" in wb_empty.sheetnames
        assert "Sentence History" in wb_empty.sheetnames
        assert "Export Information" in wb_empty.sheetnames

        # Check export info sheet
        sheet_info = wb_empty["Export Information"]
        info_rows = list(sheet_info.iter_rows(values_only=True))
        assert any("Total Sentence Records" in str(row[0]) for row in info_rows)

        # 2. Add a sentence with formula-like text to test injection protection in output
        malicious_input = "=cmd|' /C calc'!A0"
        sentence_payload = {
            "original_signs": ["YES", "HELLO"],
            "confirmed_sentence": malicious_input,
            "english_output": "Formula Test",
            "telugu_output": "సూత్ర పరీక్ష",
            "romanized_telugu": "Soothra Pareeksha",
            "selected_language": "te",
            "recognition_mode": "sentence_builder"
        }
        res_save = await ac.post("/history/sentence", json=sentence_payload, headers=headers)
        assert res_save.status_code == 200

        # 3. Export again and inspect sentence sheet
        res_export = await ac.get("/history/export/excel", headers=headers)
        assert res_export.status_code == 200
        wb = openpyxl.load_workbook(filename=io.BytesIO(res_export.content))
        
        sentence_sheet = wb["Sentence History"]
        rows = list(sentence_sheet.iter_rows(values_only=True))
        
        # Find the header row containing "Record ID"
        header_row_idx = next(i for i, r in enumerate(rows) if r and "Record ID" in r)
        headers_row = rows[header_row_idx]
        assert "Confirmed Sentence" in headers_row

        # Check that the formula text is escaped safely with leading single quote
        data_rows = rows[header_row_idx + 1:]
        confirmed_col_idx = headers_row.index("Confirmed Sentence")
        confirmed_vals = [r[confirmed_col_idx] for r in data_rows if r and r[confirmed_col_idx] is not None]
        assert f"'{malicious_input}" in confirmed_vals
