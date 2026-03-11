import sgMail from "@sendgrid/mail";

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

const FROM = {
  email: process.env.SENDGRID_FROM_EMAIL ?? "noreply@sprava.top",
  name: "Sprava",
};

/* ── Brand tokens (keep in sync with desktop theme) ── */
const BRAND = {
  bg: "#0B0C10",
  surface: "#12131A",
  elevated: "#181924",
  border: "#252738",
  borderSubtle: "#1A1C2A",
  primary: "#F08C50",
  primaryHover: "#F59E68",
  accent: "#9B6BF7",
  textPrimary: "#F0EEF9",
  textSecondary: "#9492AC",
  textMuted: "#555370",
};

function emailShell(content: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Sprava</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};font-family:-apple-system,'Segoe UI','Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${BRAND.bg};">
    <tr>
      <td align="center" style="padding:48px 16px;">

        <!-- Logo + Mascot -->
        <table width="520" cellpadding="0" cellspacing="0" role="presentation">
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <!--[if !mso]><!-->
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="24 24 208 208" width="56" height="56" style="display:block;margin:0 auto 12px;">
                <rect x="36" y="36" width="184" height="184" rx="56" fill="#0A1020" stroke="#F28C4A" stroke-width="10"/>
                <circle cx="98" cy="108" r="14" fill="#EDECF6"/>
                <circle cx="158" cy="108" r="14" fill="#EDECF6"/>
                <path d="M88 158 Q104 140 120 158 T152 158 T184 158" stroke="#2DD4BF" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
              </svg>
              <!--<![endif]-->
              <span style="font-size:26px;font-weight:800;letter-spacing:-1px;color:${BRAND.textPrimary};font-family:'Georgia',serif;">Spr<span style="color:${BRAND.primary};">a</span>va</span>
            </td>
          </tr>
        </table>

        <!-- Card -->
        <table width="520" cellpadding="0" cellspacing="0" role="presentation" style="background:${BRAND.surface};border:1px solid ${BRAND.border};border-radius:16px;overflow:hidden;">
          <!-- Gradient bar -->
          <tr>
            <td style="height:4px;background:linear-gradient(90deg,${BRAND.primary} 0%,${BRAND.accent} 100%);font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:40px 36px 44px;">
              ${content}
            </td>
          </tr>
        </table>

        <!-- Footer -->
        <table width="520" cellpadding="0" cellspacing="0" role="presentation">
          <tr>
            <td align="center" style="padding:28px 0;">
              <p style="margin:0;color:${BRAND.textMuted};font-size:12px;line-height:1.5;">
                &copy; ${new Date().getFullYear()} Sprava &mdash; Tous droits r&eacute;serv&eacute;s
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function verifySuccessPage(): string {
  const content = `
              <div style="text-align:center;">
                <div style="display:inline-block;width:56px;height:56px;border-radius:50%;background:${BRAND.primary}20;margin-bottom:20px;line-height:56px;font-size:28px;">
                  &#10003;
                </div>
                <h2 style="margin:0 0 8px;color:${BRAND.textPrimary};font-size:22px;font-weight:700;letter-spacing:-0.3px;">
                  Email v&eacute;rifi&eacute; !
                </h2>
                <p style="margin:0 0 12px;color:${BRAND.textSecondary};font-size:15px;line-height:1.7;">
                  Votre adresse email a &eacute;t&eacute; confirm&eacute;e avec succ&egrave;s.<br/>
                  Vous pouvez fermer cette page et retourner sur Sprava.
                </p>
                <a href="sprava://email/verified" style="display:inline-block;margin-top:16px;padding:12px 28px;background:${BRAND.primary};color:#08090C;font-size:15px;font-weight:700;text-decoration:none;border-radius:10px;letter-spacing:0.2px;">
                  Ouvrir Sprava
                </a>
              </div>`;
  return emailShell(content);
}

export function verifyErrorPage(message: string): string {
  const content = `
              <div style="text-align:center;">
                <div style="display:inline-block;width:56px;height:56px;border-radius:50%;background:#E5484D20;margin-bottom:20px;line-height:56px;font-size:28px;color:#E5484D;">
                  &#10007;
                </div>
                <h2 style="margin:0 0 8px;color:${BRAND.textPrimary};font-size:22px;font-weight:700;letter-spacing:-0.3px;">
                  &Eacute;chec de la v&eacute;rification
                </h2>
                <p style="margin:0 0 28px;color:${BRAND.textSecondary};font-size:15px;line-height:1.7;">
                  ${message}
                </p>
              </div>`;
  return emailShell(content);
}

export async function sendVerificationEmail(
  to: string,
  token: string,
): Promise<void> {
  const url = `${process.env.APP_URL}/auth/verify-email?token=${token}`;

  const content = `
              <h2 style="margin:0 0 8px;color:${BRAND.textPrimary};font-size:22px;font-weight:700;letter-spacing:-0.3px;">
                V&eacute;rifiez votre adresse email
              </h2>
              <p style="margin:0 0 28px;color:${BRAND.textSecondary};font-size:15px;line-height:1.7;">
                Bienvenue sur Sprava ! Confirmez votre adresse email pour activer votre compte et commencer &agrave; discuter.
              </p>

              <!-- Button -->
              <table cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="border-radius:10px;background:${BRAND.primary};">
                    <a href="${url}" style="display:inline-block;padding:14px 32px;color:#08090C;font-size:15px;font-weight:700;text-decoration:none;letter-spacing:0.2px;">
                      V&eacute;rifier mon email
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:28px 0 0;color:${BRAND.textMuted};font-size:13px;line-height:1.6;">
                Ce lien expire dans <span style="color:${BRAND.textSecondary};font-weight:600;">24 heures</span>.<br/>
                Si vous n&rsquo;avez pas cr&eacute;&eacute; de compte, ignorez cet email.
              </p>

              <!-- Divider -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:24px 0;">
                <tr><td style="border-top:1px solid ${BRAND.borderSubtle};font-size:0;line-height:0;">&nbsp;</td></tr>
              </table>

              <p style="margin:0;color:${BRAND.textMuted};font-size:12px;line-height:1.5;">
                Ou copiez ce lien&nbsp;:<br/>
                <a href="${url}" style="color:${BRAND.primary};word-break:break-all;text-decoration:none;">${url}</a>
              </p>`;

  await sgMail.send({
    to,
    from: FROM,
    subject: "Vérifiez votre adresse email — Sprava",
    text: `Cliquez sur ce lien pour vérifier votre compte : ${url}\n\nCe lien expire dans 24 heures.`,
    html: emailShell(content),
  });
}

export async function sendPasswordResetEmail(
  to: string,
  token: string,
): Promise<void> {
  const url = `${process.env.APP_URL}/auth/reset-password?token=${token}`;

  const content = `
              <h2 style="margin:0 0 8px;color:${BRAND.textPrimary};font-size:22px;font-weight:700;letter-spacing:-0.3px;">
                R&eacute;initialisation du mot de passe
              </h2>
              <p style="margin:0 0 28px;color:${BRAND.textSecondary};font-size:15px;line-height:1.7;">
                Vous avez demand&eacute; &agrave; r&eacute;initialiser votre mot de passe. Cliquez sur le bouton ci-dessous pour en choisir un nouveau.
              </p>

              <!-- Button -->
              <table cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="border-radius:10px;background:${BRAND.primary};">
                    <a href="${url}" style="display:inline-block;padding:14px 32px;color:#08090C;font-size:15px;font-weight:700;text-decoration:none;letter-spacing:0.2px;">
                      R&eacute;initialiser mon mot de passe
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:28px 0 0;color:${BRAND.textMuted};font-size:13px;line-height:1.6;">
                Ce lien expire dans <span style="color:${BRAND.textSecondary};font-weight:600;">1 heure</span>.<br/>
                Si vous n&rsquo;avez pas fait cette demande, ignorez cet email &mdash; votre compte est en s&eacute;curit&eacute;.
              </p>

              <!-- Divider -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:24px 0;">
                <tr><td style="border-top:1px solid ${BRAND.borderSubtle};font-size:0;line-height:0;">&nbsp;</td></tr>
              </table>

              <p style="margin:0;color:${BRAND.textMuted};font-size:12px;line-height:1.5;">
                Ou copiez ce lien&nbsp;:<br/>
                <a href="${url}" style="color:${BRAND.primary};word-break:break-all;text-decoration:none;">${url}</a>
              </p>`;

  await sgMail.send({
    to,
    from: FROM,
    subject: "Réinitialisez votre mot de passe — Sprava",
    text: `Cliquez sur ce lien pour réinitialiser votre mot de passe : ${url}\n\nCe lien expire dans 1 heure. Si vous n'avez pas fait cette demande, ignorez cet email.`,
    html: emailShell(content),
  });
}
