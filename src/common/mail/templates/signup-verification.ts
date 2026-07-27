export const SIGNUP_VERIFICATION_SUBJECT =
  "[DAMARA] 회원가입 이메일 인증번호를 확인해 주세요";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function renderSignupVerificationEmail(
  verificationCode: string,
  expiresInMinutes: number
) {
  if (!/^\d{6}$/.test(verificationCode) || expiresInMinutes <= 0) {
    throw new Error("INVALID_SIGNUP_VERIFICATION_TEMPLATE_VARIABLES");
  }

  const code = escapeHtml(verificationCode);
  const minutes = String(expiresInMinutes);

  return {
    subject: SIGNUP_VERIFICATION_SUBJECT,
    html: `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>DAMARA 회원가입 이메일 인증</title>
  </head>
  <body style="margin:0;padding:0;background:#f5f6f8;font-family:Arial,'Apple SD Gothic Neo','Noto Sans KR',sans-serif;color:#202124;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f6f8;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border-radius:12px;padding:40px 32px;">
          <tr><td>
            <p style="margin:0 0 24px;font-size:20px;font-weight:700;">DAMARA</p>
            <h1 style="margin:0 0 16px;font-size:24px;line-height:1.4;">회원가입 이메일 인증</h1>
            <p style="margin:0 0 24px;font-size:15px;line-height:1.7;">DAMARA 회원가입을 위한 인증번호입니다.<br />아래 인증번호를 인증 화면에 입력해 주세요.</p>
            <div style="margin:0 0 24px;padding:20px;text-align:center;background:#f1f3f5;border-radius:8px;font-size:32px;font-weight:700;letter-spacing:8px;">${code}</div>
            <p style="margin:0 0 8px;font-size:14px;line-height:1.6;">인증번호는 발송 후 <strong>${minutes}분</strong> 동안 유효합니다.</p>
            <p style="margin:0;font-size:13px;line-height:1.6;color:#666;">본인이 요청하지 않았다면 이 이메일을 무시해 주세요. 인증번호는 다른 사람에게 공유하지 마세요.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`,
    text: `DAMARA 회원가입 이메일 인증

DAMARA 회원가입을 위한 인증번호입니다.
아래 인증번호를 인증 화면에 입력해 주세요.

인증번호: ${verificationCode}

인증번호는 발송 후 ${minutes}분 동안 유효합니다.

본인이 요청하지 않았다면 이 이메일을 무시해 주세요.
인증번호는 다른 사람에게 공유하지 마세요.`,
  };
}
