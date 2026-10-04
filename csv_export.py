import csv
import io
from fastapi import Response
from app.models import Student


class CSVExportService:
    def export_students(self, students: list[Student]) -> Response:
        output = io.StringIO()
        writer = csv.writer(output)

        headers = [
            "ID", "Name", "College", "Domain", "Contact Number",
            "Joining Date", "Duration", "Batch", "Status", "Created At"
        ]
        writer.writerow(headers)

        for student in students:
            writer.writerow([
                student.id,
                student.name,
                student.college,
                student.domain,
                student.contact_number,
                student.joining_date,
                student.duration,
                student.batch.value if student.batch else "",
                student.status.value if student.status else "",
                student.created_at,
            ])

        output.seek(0)
        return Response(
            content=output.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=students_export.csv"}
        )

    def export_daily_report(self, students: list[Student], date: str) -> Response:
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Daily Report", date, "", "", "", "", "", "", "", ""])
        writer.writerow([])
        headers = [
            "ID", "Name", "College", "Domain", "Contact Number",
            "Joining Date", "Duration", "Batch", "Status", "Created At"
        ]
        writer.writerow(headers)
        for student in students:
            writer.writerow([
                student.id, student.name, student.college, student.domain,
                student.contact_number, student.joining_date, student.duration,
                student.batch.value if student.batch else "",
                student.status.value if student.status else "",
                student.created_at,
            ])
        output.seek(0)
        return Response(
            content=output.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=daily_report_{date}.csv"}
        )
