import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import settings


def send_plain_password_email(
    to_email: str, employee_name: str, password: str, employee_id: str | None = None
) -> None:
    """
    Send plain password via email (legacy/insecure method).

    WARNING: This is insecure. Only use for backwards compatibility.

    Args:
        to_email: Recipient email address
        employee_name: Name of the employee
        password: Plain text password
    """
    smtp_host = settings.SMTP_HOST
    smtp_port = settings.SMTP_PORT
    smtp_user = settings.SMTP_USER
    smtp_pass = settings.SMTP_PASS
    email_from = settings.EMAIL_FROM or smtp_user

    subject = "รหัสผ่านบัญชีของคุณ"

    # Pre-compute optional blocks (no backslashes inside f-string expressions)
    emp_id_text = f"รหัสพนักงาน: {employee_id}\n\n" if employee_id else ""
    emp_id_html = (
        f"<p><strong>รหัสพนักงาน:</strong> {employee_id}</p>" if employee_id else ""
    )

    text_body = (
        f"เรียน {employee_name},\n\n"
        f"ตามคำขอ นี่คือรหัสผ่านบัญชีของคุณ:\n\n"
        f"{password}\n\n"
        f"{emp_id_text}"
        f"หากคุณไม่ได้ร้องขอ โปรดติดต่อผู้ดูแลระบบ\n\n"
        f"ด้วยความนับถือ,\nทีม โครงการพัฒนาระบบ\n"
        f"ส่งจาก: {email_from}"
    )

    html_body = f"""<html>
  <body style="font-family: Arial, sans-serif; line-height: 1.6;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #333;">รหัสผ่านบัญชีของคุณ</h2>
      <p>เรียน <strong>{employee_name}</strong>,</p>
      {emp_id_html}
      <p>ตามคำขอ นี่คือรหัสผ่านบัญชีของคุณ:</p>
      <p style="font-size:42px;color:#0047b3;font-weight:700;">{password}</p>
      <p>หากคุณไม่ได้ร้องขอ โปรดติดต่อผู้ดูแลระบบ</p>
      <p>ด้วยความนับถือ,<br/><strong>ทีม โครงการพัฒนาระบบ</strong></p>
      <p style="font-size:12px; color:#666;">อีเมล: {email_from}</p>
    </div>
  </body>
</html>"""

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = email_from
    msg["To"] = to_email
    msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP(smtp_host, smtp_port) as server:
        server.ehlo()
        server.starttls()
        if smtp_user and smtp_pass:
            server.login(smtp_user, smtp_pass)
        server.sendmail(email_from, to_email, msg.as_string())


def send_change_password_notification_email(
    to_email: str, employee_name: str, new_password: str, employee_id: str | None = None
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

    subject = "แจ้งเปลี่ยนรหัสผ่าน"

    emp_id_text = f"รหัสพนักงาน: {employee_id}\n\n" if employee_id else ""
    emp_id_html = (
        f"<p><strong>รหัสพนักงาน:</strong> {employee_id}</p>" if employee_id else ""
    )

    text_body = (
        f"เรียน {employee_name},\n\n"
        f"รหัสผ่านของคุณถูกเปลี่ยนแปลงเรียบร้อยแล้ว\n\n"
        f"รหัสผ่านใหม่ของคุณคือ:\n\n"
        f"{new_password}\n\n"
        f"{emp_id_text}"
        f"กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่นี้\n\n"
        f"ด้วยความนับถือ,\nทีม GUTSESS\n"
        f"ส่งจาก: {email_from}"
    )

    html_body = f"""<html>
  <body style="font-family: Arial, sans-serif; line-height: 1.6;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #333;">แจ้งเปลี่ยนรหัสผ่าน</h2>
      <p>เรียน <strong>{employee_name}</strong>,</p>
      {emp_id_html}
      <p>รหัสผ่านของคุณถูกเปลี่ยนแปลงเรียบร้อยแล้ว</p>
      <p>รหัสผ่านใหม่ของคุณคือ:</p>
      <p style="font-size:42px;color:#0047b3;font-weight:700;">{new_password}</p>
      <p>กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่นี้</p>
      <p>ด้วยความนับถือ,<br/><strong>ทีม GUTSESS</strong></p>
      <p style="font-size:12px; color:#666;">อีเมล: {email_from}</p>
    </div>
  </body>
</html>"""

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = email_from
    msg["To"] = to_email
    msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP(smtp_host, smtp_port) as server:
        server.ehlo()
        server.starttls()
        if smtp_user and smtp_pass:
            server.login(smtp_user, smtp_pass)
        server.sendmail(email_from, to_email, msg.as_string())
