import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import settings


def _format_employee_name(employee_name: str) -> str:
    display_name = (employee_name or "").strip()

    if not display_name:
        return "คุณ"

    if display_name.startswith("คุณ"):
        return display_name

    return f"คุณ{display_name}"


def send_plain_password_email(
    to_email: str,
    employee_name: str,
    password: str,
    employee_id: str | None = None,
) -> None:
    """
    Send plain password via email.

    Args:
        to_email: Recipient email address
        employee_name: Name of the employee
        password: Plain text password
        employee_id: Employee code
    """
    smtp_host = settings.SMTP_HOST
    smtp_port = settings.SMTP_PORT
    smtp_user = settings.SMTP_USER
    smtp_pass = settings.SMTP_PASS
    email_from = settings.EMAIL_FROM or smtp_user

    subject = "ระบบให้บริการตนเอง GUTS ESS (Employee Self Service)"

    display_name = _format_employee_name(employee_name)
    emp_code = employee_id or "-"

    text_body = (
        f"เรียน {display_name}\n\n"
        f"ระบบให้บริการตนเอง\n"
        f"GUTS ESS (Employee Self Service)\n\n"
        f"ข้อมูลการเข้าระบบของท่านคือ\n\n"
        f"รหัสพนักงาน : {emp_code}\n"
        f"รหัสผ่าน : {password}\n\n"
        f"ระหว่างการทดสอบระบบ\n"
        f"หากท่านพบปัญหาการใช้งาน\n"
        f"ติดต่อช่องทางที่กำหนด\n"
        f"กลุ่มไลน์ \"GUTS ESS\" เท่านั้น\n\n"
        f"ขอแสดงความนับถือ\n"
        f"GUTS ESS"
    )

    html_body = f"""<html>
  <body style="font-family: Arial, 'Sarabun', sans-serif; line-height: 1.7; color: #222;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
      <p style="font-size: 18px; margin: 0 0 28px 0;">
        เรียน <strong>{display_name}</strong>
      </p>

      <p style="font-size: 20px; font-weight: 700; margin: 0 0 28px 0;">
        ระบบให้บริการตนเอง<br/>
        GUTS ESS (Employee Self Service)
      </p>

      <p style="font-size: 18px; margin: 0 0 18px 0;">
        ข้อมูลการเข้าระบบของท่านคือ
      </p>

      <p style="font-size: 18px; margin: 0 0 32px 0;">
        <strong>รหัสพนักงาน :</strong> {emp_code}<br/>
        <strong>รหัสผ่าน :</strong>
        <span style="font-size: 42px; color: #0047b3; font-weight: 700;">
          {password}
        </span>
      </p>

      <p style="font-size: 18px; margin: 0 0 32px 0;">
        ระหว่างการทดสอบระบบ<br/>
        หากท่านพบปัญหาการใช้งาน<br/>
        ติดต่อช่องทางที่กำหนด<br/>
        กลุ่มไลน์ <strong>"GUTS ESS"</strong> เท่านั้น
      </p>

      <p style="font-size: 18px; margin: 0;">
        ขอแสดงความนับถือ<br/>
        <strong>GUTS ESS</strong>
      </p>
    </div>
  </body>
</html>"""

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = email_from
    msg["To"] = to_email
    msg.attach(MIMEText(text_body, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    with smtplib.SMTP(smtp_host, smtp_port) as server:
        server.ehlo()
        server.starttls()
        if smtp_user and smtp_pass:
            server.login(smtp_user, smtp_pass)
        server.sendmail(email_from, to_email, msg.as_string())


def send_change_password_notification_email(
    to_email: str,
    employee_name: str,
    new_password: str,
    employee_id: str | None = None,
) -> None:
    """
    Send an email notifying the employee that their password has been changed,
    with the new password included.

    Args:
        to_email: Recipient email address
        employee_name: Name of the employee
        new_password: The new password
        employee_id: Employee code
    """
    smtp_host = settings.SMTP_HOST
    smtp_port = settings.SMTP_PORT
    smtp_user = settings.SMTP_USER
    smtp_pass = settings.SMTP_PASS
    email_from = settings.EMAIL_FROM or smtp_user

    subject = "ระบบให้บริการตนเอง GUTS ESS (Employee Self Service)"

    display_name = _format_employee_name(employee_name)
    emp_code = employee_id or "-"

    text_body = (
        f"เรียน {display_name}\n\n"
        f"ระบบให้บริการตนเอง\n"
        f"GUTS ESS (Employee Self Service)\n\n"
        f"ข้อมูลการเข้าระบบของท่านคือ\n\n"
        f"รหัสพนักงาน : {emp_code}\n"
        f"รหัสผ่าน : {new_password}\n\n"
        f"ระหว่างการทดสอบระบบ\n"
        f"หากท่านพบปัญหาการใช้งาน\n"
        f"ติดต่อช่องทางที่กำหนด\n"
        f"กลุ่มไลน์ \"GUTS ESS\" เท่านั้น\n\n"
        f"ขอแสดงความนับถือ\n"
        f"GUTS ESS"
    )

    html_body = f"""<html>
  <body style="font-family: Arial, 'Sarabun', sans-serif; line-height: 1.7; color: #222;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
      <p style="font-size: 18px; margin: 0 0 28px 0;">
        เรียน <strong>{display_name}</strong>
      </p>

      <p style="font-size: 20px; font-weight: 700; margin: 0 0 28px 0;">
        ระบบให้บริการตนเอง<br/>
        GUTS ESS (Employee Self Service)
      </p>

      <p style="font-size: 18px; margin: 0 0 18px 0;">
        ข้อมูลการเข้าระบบของท่านคือ
      </p>

      <p style="font-size: 18px; margin: 0 0 32px 0;">
        <strong>รหัสพนักงาน :</strong> {emp_code}<br/>
        <strong>รหัสผ่าน :</strong>
        <span style="font-size: 42px; color: #0047b3; font-weight: 700;">
          {new_password}
        </span>
      </p>

      <p style="font-size: 18px; margin: 0 0 32px 0;">
        ระหว่างการทดสอบระบบ<br/>
        หากท่านพบปัญหาการใช้งาน<br/>
        ติดต่อช่องทางที่กำหนด<br/>
        กลุ่มไลน์ <strong>"GUTS ESS"</strong> เท่านั้น
      </p>

      <p style="font-size: 18px; margin: 0;">
        ขอแสดงความนับถือ<br/>
        <strong>GUTS ESS</strong>
      </p>
    </div>
  </body>
</html>"""

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = email_from
    msg["To"] = to_email
    msg.attach(MIMEText(text_body, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    with smtplib.SMTP(smtp_host, smtp_port) as server:
        server.ehlo()
        server.starttls()
        if smtp_user and smtp_pass:
            server.login(smtp_user, smtp_pass)
        server.sendmail(email_from, to_email, msg.as_string())