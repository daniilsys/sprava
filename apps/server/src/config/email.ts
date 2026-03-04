import sgMail from "@sendgrid/mail";

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

const FROM = {
  email: process.env.SENDGRID_FROM_EMAIL ?? "noreply@sprava.top",
  name: "Sprava",
};

export async function sendVerificationEmail(
  to: string,
  token: string,
): Promise<void> {
  const url = `${process.env.APP_URL}/auth/verify-email?token=${token}`;

  await sgMail.send({
    to,
    from: FROM,
    subject: "Vérifiez votre adresse email — Sprava",
    text: `Cliquez sur ce lien pour vérifier votre compte : ${url}\n\nCe lien expire dans 24 heures.`,
    html: `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#0f0f0f;font-family:'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:48px 16px;">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="background:#5865f2;padding:32px;text-align:center;">
              <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">Sprava</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 32px;">
              <h2 style="margin:0 0 12px;color:#fff;font-size:20px;font-weight:600;">Vérifiez votre adresse email</h2>
              <p style="margin:0 0 32px;color:#a0a0a0;font-size:15px;line-height:1.6;">
                Merci de vous être inscrit sur Sprava. Cliquez sur le bouton ci-dessous pour confirmer votre adresse email et activer votre compte.
              </p>
              <a href="${url}" style="display:inline-block;background:#5865f2;color:#fff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 28px;border-radius:8px;">
                Vérifier mon email
              </a>
              <p style="margin:32px 0 0;color:#606060;font-size:13px;line-height:1.5;">
                Ce lien expire dans <strong style="color:#a0a0a0;">24 heures</strong>.<br/>
                Si vous n'avez pas créé de compte, ignorez cet email.
              </p>
              <hr style="margin:24px 0;border:none;border-top:1px solid #2a2a2a;" />
              <p style="margin:0;color:#404040;font-size:12px;">
                Ou copiez ce lien dans votre navigateur :<br/>
                <span style="color:#5865f2;word-break:break-all;">${url}</span>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  });
}

export async function sendPasswordResetEmail(
  to: string,
  token: string,
): Promise<void> {
  const url = `${process.env.APP_URL}/auth/reset-password?token=${token}`;

  await sgMail.send({
    to,
    from: FROM,
    subject: "Réinitialisez votre mot de passe — Sprava",
    text: `Cliquez sur ce lien pour réinitialiser votre mot de passe : ${url}\n\nCe lien expire dans 1 heure. Si vous n'avez pas fait cette demande, ignorez cet email.`,
    html: `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#0f0f0f;font-family:'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:48px 16px;">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="background:#5865f2;padding:32px;text-align:center;">
              <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">Sprava</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 32px;">
              <h2 style="margin:0 0 12px;color:#fff;font-size:20px;font-weight:600;">Réinitialisation du mot de passe</h2>
              <p style="margin:0 0 32px;color:#a0a0a0;font-size:15px;line-height:1.6;">
                Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous pour en choisir un nouveau.
              </p>
              <a href="${url}" style="display:inline-block;background:#5865f2;color:#fff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 28px;border-radius:8px;">
                Réinitialiser mon mot de passe
              </a>
              <p style="margin:32px 0 0;color:#606060;font-size:13px;line-height:1.5;">
                Ce lien expire dans <strong style="color:#a0a0a0;">1 heure</strong>.<br/>
                Si vous n'avez pas fait cette demande, ignorez cet email — votre compte est en sécurité.
              </p>
              <hr style="margin:24px 0;border:none;border-top:1px solid #2a2a2a;" />
              <p style="margin:0;color:#404040;font-size:12px;">
                Ou copiez ce lien dans votre navigateur :<br/>
                <span style="color:#5865f2;word-break:break-all;">${url}</span>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  });
}
