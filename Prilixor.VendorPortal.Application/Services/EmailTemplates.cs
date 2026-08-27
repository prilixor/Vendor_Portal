using System.Net;
using System.Text.RegularExpressions;
using Prilixor.VendorPortal.Application.Common;

namespace Prilixor.VendorPortal.Application.Services;

public static class EmailTemplates
{
    private static readonly Regex DoctorTitlePrefix = new(@"^(dr\.?|doctor)\b", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    public static string VendorEmailVerificationRequested(string vendorEmail, string verificationLink, string vendorName = "")
    {
        var name = string.IsNullOrWhiteSpace(vendorName) ? vendorEmail : vendorName;
        return $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset='utf-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
    <title>Verify Your Email</title>
</head>
<body style='font-family: Arial, sans-serif; line-height: 1.6; color: #333;'>
    <div style='max-width: 600px; margin: 0 auto; padding: 20px;'>
        <div style='background: linear-gradient(135deg, #2563eb 0%, #0f766e 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;'>
            <h1 style='color: white; margin: 0; font-size: 28px;'>Verify Your Email</h1>
        </div>
        <div style='background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0;'>
            <p style='font-size: 16px; margin-bottom: 20px;'>Dear {name},</p>
            <p style='font-size: 16px; margin-bottom: 20px;'>Thanks for registering. Please verify your email address to continue.</p>
            <div style='text-align: center; margin: 30px 0;'>
                <a href='{verificationLink}' style='background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-size: 16px; font-weight: bold;'>Verify Email</a>
            </div>
            <p style='font-size: 14px; color: #666; margin-top: 20px;'>This link will expire in 24 hours.</p>
            <p style='font-size: 14px; color: #666;'>If you did not create this account, you can ignore this email.</p>
            <p style='font-size: 14px; color: #666; margin-top: 30px;'>Best regards,<br>The BlinksMed Team</p>
        </div>
    </div>
</body>
</html>";
    }

    public static string VendorApproved(string vendorEmail, string vendorName = "")
    {
        var name = string.IsNullOrWhiteSpace(vendorName) ? vendorEmail : vendorName;
        return $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset='utf-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
    <title>Vendor Account Approved</title>
</head>
<body style='font-family: Arial, sans-serif; line-height: 1.6; color: #333;'>
    <div style='max-width: 600px; margin: 0 auto; padding: 20px;'>
        <div style='background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;'>
            <h1 style='color: white; margin: 0; font-size: 28px;'>🎉 Welcome!</h1>
        </div>
        <div style='background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0;'>
            <p style='font-size: 16px; margin-bottom: 20px;'>Dear {name},</p>
            <p style='font-size: 16px; margin-bottom: 20px;'>Congratulations! Your vendor account has been <strong style='color: #10b981;'>approved</strong>.</p>
            <p style='font-size: 16px; margin-bottom: 20px;'>You can now start listing your products and receiving rental requests. Here's what you can do next:</p>
            <ul style='font-size: 16px; margin-bottom: 20px; padding-left: 20px;'>
                <li style='margin-bottom: 10px;'>Complete your business profile</li>
                <li style='margin-bottom: 10px;'>Add your products for rent</li>
                <li style='margin-bottom: 10px;'>Set your service areas and working hours</li>
                <li>Configure your notification preferences</li>
            </ul>
            <div style='text-align: center; margin: 30px 0;'>
                <a href='https://vendor.blinksmed.com/vendor' style='background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-size: 16px; font-weight: bold;'>Go to Dashboard</a>
            </div>
            <p style='font-size: 14px; color: #666; margin-top: 30px;'>If you have any questions, please contact our support team.</p>
            <p style='font-size: 14px; color: #666;'>Best regards,<br>The BlinksMed Team</p>
        </div>
    </div>
</body>
</html>";
    }

    public static string VendorRejected(string vendorEmail, string reason, string vendorName = "")
    {
        var name = string.IsNullOrWhiteSpace(vendorName) ? vendorEmail : vendorName;
        return $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset='utf-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
    <title>Vendor Account Rejected</title>
</head>
<body style='font-family: Arial, sans-serif; line-height: 1.6; color: #333;'>
    <div style='max-width: 600px; margin: 0 auto; padding: 20px;'>
        <div style='background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;'>
            <h1 style='color: white; margin: 0; font-size: 28px;'>Account Not Approved</h1>
        </div>
        <div style='background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0;'>
            <p style='font-size: 16px; margin-bottom: 20px;'>Dear {name},</p>
            <p style='font-size: 16px; margin-bottom: 20px;'>We regret to inform you that your vendor account application has been <strong style='color: #ef4444;'>rejected</strong>.</p>
            <div style='background: #fee2e2; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ef4444;'>
                <p style='font-size: 14px; margin: 0; color: #991b1b;'><strong>Reason:</strong> {reason}</p>
            </div>
            <p style='font-size: 16px; margin-bottom: 20px;'>If you believe this is an error or would like to address the issues mentioned, please contact our support team for assistance.</p>
            <p style='font-size: 14px; color: #666; margin-top: 30px;'>Best regards,<br>The BlinksMed Team</p>
        </div>
    </div>
</body>
</html>";
    }

    public static string VendorSuspended(string vendorEmail, string reason, string vendorName = "")
    {
        var name = string.IsNullOrWhiteSpace(vendorName) ? vendorEmail : vendorName;
        return $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset='utf-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
    <title>Account Suspended</title>
</head>
<body style='font-family: Arial, sans-serif; line-height: 1.6; color: #333;'>
    <div style='max-width: 600px; margin: 0 auto; padding: 20px;'>
        <div style='background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;'>
            <h1 style='color: white; margin: 0; font-size: 28px;'>⚠️ Account Suspended</h1>
        </div>
        <div style='background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0;'>
            <p style='font-size: 16px; margin-bottom: 20px;'>Dear {name},</p>
            <p style='font-size: 16px; margin-bottom: 20px;'>Your vendor account has been <strong style='color: #f59e0b;'>suspended</strong> temporarily.</p>
            <div style='background: #fef3c7; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #f59e0b;'>
                <p style='font-size: 14px; margin: 0; color: #92400e;'><strong>Reason:</strong> {reason}</p>
            </div>
            <p style='font-size: 16px; margin-bottom: 20px;'>During this suspension, you will not be able to receive new rental requests. Please contact our support team to resolve this issue.</p>
            <p style='font-size: 14px; color: #666; margin-top: 30px;'>Best regards,<br>The BlinksMed Team</p>
        </div>
    </div>
</body>
</html>";
    }

    public static string VendorBanned(string vendorEmail, string reason, string vendorName = "")
    {
        var name = string.IsNullOrWhiteSpace(vendorName) ? vendorEmail : vendorName;
        return $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset='utf-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
    <title>Account Banned</title>
</head>
<body style='font-family: Arial, sans-serif; line-height: 1.6; color: #333;'>
    <div style='max-width: 600px; margin: 0 auto; padding: 20px;'>
        <div style='background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;'>
            <h1 style='color: white; margin: 0; font-size: 28px;'>🚫 Account Banned</h1>
        </div>
        <div style='background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0;'>
            <p style='font-size: 16px; margin-bottom: 20px;'>Dear {name},</p>
            <p style='font-size: 16px; margin-bottom: 20px;'>Your vendor account has been <strong style='color: #dc2626;'>permanently banned</strong> from the platform.</p>
            <div style='background: #fee2e2; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #dc2626;'>
                <p style='font-size: 14px; margin: 0; color: #7f1d1d;'><strong>Reason:</strong> {reason}</p>
            </div>
            <p style='font-size: 16px; margin-bottom: 20px;'>This decision is final and your account cannot be reactivated. If you believe this is an error, please contact our support team.</p>
            <p style='font-size: 14px; color: #666; margin-top: 30px;'>Best regards,<br>The BlinksMed Team</p>
        </div>
    </div>
</body>
</html>";
    }

    public static string VendorReactivated(string vendorEmail, string vendorName = "")
    {
        var name = string.IsNullOrWhiteSpace(vendorName) ? vendorEmail : vendorName;
        return $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset='utf-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
    <title>Account Reactivated</title>
</head>
<body style='font-family: Arial, sans-serif; line-height: 1.6; color: #333;'>
    <div style='max-width: 600px; margin: 0 auto; padding: 20px;'>
        <div style='background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;'>
            <h1 style='color: white; margin: 0; font-size: 28px;'>✅ Welcome Back!</h1>
        </div>
        <div style='background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0;'>
            <p style='font-size: 16px; margin-bottom: 20px;'>Dear {name},</p>
            <p style='font-size: 16px; margin-bottom: 20px;'>Great news! Your vendor account has been <strong style='color: #10b981;'>reactivated</strong>.</p>
            <p style='font-size: 16px; margin-bottom: 20px;'>You can now resume your activities on the platform and start receiving rental requests again.</p>
            <div style='text-align: center; margin: 30px 0;'>
                <a href='https://vendor.blinksmed.com/vendor' style='background: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-size: 16px; font-weight: bold;'>Go to Dashboard</a>
            </div>
            <p style='font-size: 14px; color: #666; margin-top: 30px;'>Best regards,<br>The BlinksMed Team</p>
        </div>
    </div>
</body>
</html>";
    }

    public static string DocumentApproved(string vendorEmail, string documentType, string vendorName = "")
    {
        var name = string.IsNullOrWhiteSpace(vendorName) ? vendorEmail : vendorName;
        return $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset='utf-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
    <title>Document Approved</title>
</head>
<body style='font-family: Arial, sans-serif; line-height: 1.6; color: #333;'>
    <div style='max-width: 600px; margin: 0 auto; padding: 20px;'>
        <div style='background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;'>
            <h1 style='color: white; margin: 0; font-size: 28px;'>📄 Document Approved</h1>
        </div>
        <div style='background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0;'>
            <p style='font-size: 16px; margin-bottom: 20px;'>Dear {name},</p>
            <p style='font-size: 16px; margin-bottom: 20px;'>Your <strong>{documentType}</strong> has been <strong style='color: #10b981;'>approved</strong>.</p>
            <p style='font-size: 16px; margin-bottom: 20px;'>This document has been verified and meets our requirements. You can continue with your onboarding process.</p>
            <p style='font-size: 14px; color: #666; margin-top: 30px;'>Best regards,<br>The BlinksMed Team</p>
        </div>
    </div>
</body>
</html>";
    }

    public static string DocumentRejected(string vendorEmail, string documentType, string reason, string vendorName = "")
    {
        var name = string.IsNullOrWhiteSpace(vendorName) ? vendorEmail : vendorName;
        return $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset='utf-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
    <title>Document Rejected</title>
</head>
<body style='font-family: Arial, sans-serif; line-height: 1.6; color: #333;'>
    <div style='max-width: 600px; margin: 0 auto; padding: 20px;'>
        <div style='background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;'>
            <h1 style='color: white; margin: 0; font-size: 28px;'>📄 Document Rejected</h1>
        </div>
        <div style='background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0;'>
            <p style='font-size: 16px; margin-bottom: 20px;'>Dear {name},</p>
            <p style='font-size: 16px; margin-bottom: 20px;'>Your <strong>{documentType}</strong> has been <strong style='color: #ef4444;'>rejected</strong>.</p>
            <div style='background: #fee2e2; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ef4444;'>
                <p style='font-size: 14px; margin: 0; color: #991b1b;'><strong>Reason:</strong> {reason}</p>
            </div>
            <p style='font-size: 16px; margin-bottom: 20px;'>Please upload a new document that meets our requirements and try again.</p>
            <p style='font-size: 14px; color: #666; margin-top: 30px;'>Best regards,<br>The BlinksMed Team</p>
        </div>
    </div>
</body>
</html>";
    }

    public static string BankAccountApproved(string vendorEmail, string vendorName = "")
    {
        var name = string.IsNullOrWhiteSpace(vendorName) ? vendorEmail : vendorName;
        return $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset='utf-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
    <title>Bank Account Approved</title>
</head>
<body style='font-family: Arial, sans-serif; line-height: 1.6; color: #333;'>
    <div style='max-width: 600px; margin: 0 auto; padding: 20px;'>
        <div style='background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;'>
            <h1 style='color: white; margin: 0; font-size: 28px;'>💳 Bank Account Approved</h1>
        </div>
        <div style='background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0;'>
            <p style='font-size: 16px; margin-bottom: 20px;'>Dear {name},</p>
            <p style='font-size: 16px; margin-bottom: 20px;'>Your bank account details have been <strong style='color: #10b981;'>approved</strong>.</p>
            <p style='font-size: 16px; margin-bottom: 20px;'>You can now receive payouts for your rentals. Your earnings will be transferred to this bank account.</p>
            <p style='font-size: 14px; color: #666; margin-top: 30px;'>Best regards,<br>The BlinksMed Team</p>
        </div>
    </div>
</body>
</html>";
    }

    public static string BankAccountRejected(string vendorEmail, string reason, string vendorName = "")
    {
        var name = string.IsNullOrWhiteSpace(vendorName) ? vendorEmail : vendorName;
        return $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset='utf-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
    <title>Bank Account Rejected</title>
</head>
<body style='font-family: Arial, sans-serif; line-height: 1.6; color: #333;'>
    <div style='max-width: 600px; margin: 0 auto; padding: 20px;'>
        <div style='background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;'>
            <h1 style='color: white; margin: 0; font-size: 28px;'>💳 Bank Account Rejected</h1>
        </div>
        <div style='background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0;'>
            <p style='font-size: 16px; margin-bottom: 20px;'>Dear {name},</p>
            <p style='font-size: 16px; margin-bottom: 20px;'>Your bank account details have been <strong style='color: #ef4444;'>rejected</strong>.</p>
            <div style='background: #fee2e2; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ef4444;'>
                <p style='font-size: 14px; margin: 0; color: #991b1b;'><strong>Reason:</strong> {reason}</p>
            </div>
            <p style='font-size: 16px; margin-bottom: 20px;'>Please update your bank account details with correct information and submit again.</p>
            <p style='font-size: 14px; color: #666; margin-top: 30px;'>Best regards,<br>The BlinksMed Team</p>
        </div>
    </div>
</body>
</html>";
    }

    public const string DoctorQrContentId = "doctor-qr";

    public static string FormatDoctorGreeting(string? fullName)
    {
        var name = (fullName ?? string.Empty).Trim();
        if (string.IsNullOrEmpty(name))
            return "Doctor";
        return DoctorTitlePrefix.IsMatch(name) ? name : $"Dr. {name}";
    }

    public static string DoctorShareInvitePlainText(
        string doctorName,
        string uniqueCode,
        string sharePageUrl,
        string? specialization = null)
    {
        var greeting = FormatDoctorGreeting(doctorName);
        var specialty = string.IsNullOrWhiteSpace(specialization) ? "" : $"\nSpecialty: {specialization.Trim()}";
        return
$@"BlinksMed — Doctor Reference ID

Dear {greeting},

Your doctor reference profile is now active on BlinksMed. Patients can name you as their referring doctor when they rent medical equipment.

Doctor Reference ID: {uniqueCode}{specialty}

Share this ID, or the Doctor Reference Card attached to this email, with your patients. They enter it at checkout — no hospital form is required.

Patient share page:
{sharePageUrl}

How patients use this
1. You share your Doctor Reference ID or the attached card.
2. The patient places an order on BlinksMed.
3. At checkout they enter your ID (or scan the QR) as their doctor reference.

This email does not create a BlinksMed login for you and does not share patient records. It only lets patients name you on their order.

Questions: {PublicSiteUrls.SupportEmail}

Warm regards,
The BlinksMed Team";
    }

    /// <param name="qrImageSrc">CID or https URL for the QR image. Do not pass a data URI — Gmail strips those.</param>
    public static string DoctorShareInvite(
        string doctorName,
        string uniqueCode,
        string sharePageUrl,
        string? specialization = null,
        string? qrImageSrc = null)
    {
        var greeting = WebUtility.HtmlEncode(FormatDoctorGreeting(doctorName));
        var code = WebUtility.HtmlEncode((uniqueCode ?? string.Empty).Trim());
        var pageUrl = WebUtility.HtmlEncode((sharePageUrl ?? string.Empty).Trim());
        var specialty = string.IsNullOrWhiteSpace(specialization)
            ? ""
            : $@"<tr><td align='center' style='padding: 6px 16px 0; font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #475569;'>{WebUtility.HtmlEncode(specialization.Trim())}</td></tr>";

        var qrBlock = string.IsNullOrWhiteSpace(qrImageSrc)
            ? ""
            : $@"
                          <tr>
                            <td align='center' style='padding: 8px 24px 4px;'>
                              <table role='presentation' cellpadding='0' cellspacing='0' border='0' width='100%' style='max-width: 280px;'>
                                <tr>
                                  <td align='center' bgcolor='#ffffff' style='padding: 16px; border: 1px solid #d9e2ec; background-color: #ffffff;'>
                                    <p style='margin: 0 0 10px; font-family: Arial, Helvetica, sans-serif; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #0f766e; font-weight: bold;'>Patient QR code</p>
                                    <img src='{qrImageSrc.Trim()}' alt='QR code for Doctor Reference ID {code}' width='200' height='200' style='display: block; width: 200px; height: 200px; border: 0; background-color: #ffffff;' />
                                    <p style='margin: 12px 0 0; font-family: Arial, Helvetica, sans-serif; font-size: 12px; line-height: 18px; color: #64748b;'>Patients scan this to open your BlinksMed share page.</p>
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                          <tr>
                            <td align='center' style='padding: 4px 24px 8px; font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #64748b;'>
                              A Doctor Reference Card (Unique ID + QR) is attached so you can save or print it for your clinic.
                            </td>
                          </tr>";

        return $@"
<!DOCTYPE html>
<html lang='en' xmlns='http://www.w3.org/1999/xhtml' xmlns:v='urn:schemas-microsoft-com:vml' xmlns:o='urn:schemas-microsoft-com:office:office'>
<head>
    <meta charset='utf-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
    <meta http-equiv='X-UA-Compatible' content='IE=edge'>
    <meta name='color-scheme' content='light'>
    <meta name='supported-color-schemes' content='light'>
    <title>Your BlinksMed Doctor Reference ID</title>
    <!--[if mso]>
    <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
    <![endif]-->
    <style type='text/css'>
      :root {{ color-scheme: light; supported-color-schemes: light; }}
      body, table, td, a {{ -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }}
      table, td {{ mso-table-lspace: 0pt; mso-table-rspace: 0pt; }}
      img {{ -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }}
    </style>
</head>
<body style='margin: 0; padding: 0; background-color: #eef2f6;'>
    <div style='display: none; max-height: 0; overflow: hidden; mso-hide: all;'>
        Your Doctor Reference ID {code} is ready. Share it with patients when they order on BlinksMed.
    </div>
    <table role='presentation' cellpadding='0' cellspacing='0' border='0' width='100%' style='background-color: #eef2f6;'>
      <tr>
        <td align='center' style='padding: 24px 12px;'>
          <table role='presentation' cellpadding='0' cellspacing='0' border='0' width='600' style='width: 100%; max-width: 600px; background-color: #ffffff;'>
            <tr>
              <td bgcolor='#0f766e' style='padding: 28px 28px 24px; background-color: #0f766e;'>
                <p style='margin: 0 0 6px; font-family: Arial, Helvetica, sans-serif; font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; color: #ccfbf1; font-weight: bold;'>BlinksMed</p>
                <h1 style='margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 24px; line-height: 32px; color: #ffffff; font-weight: 700;'>Your Doctor Reference ID</h1>
                <p style='margin: 10px 0 0; font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 22px; color: #ccfbf1;'>For patients to add you when they order medical equipment on BlinksMed.</p>
              </td>
            </tr>
            <tr>
              <td style='padding: 28px 28px 8px; font-family: Arial, Helvetica, sans-serif; font-size: 16px; line-height: 24px; color: #0f172a;'>
                Dear {greeting},
              </td>
            </tr>
            <tr>
              <td style='padding: 0 28px 20px; font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 23px; color: #334155;'>
                Your doctor reference profile is now active. Patients can share your Unique ID or scan your QR code at checkout to name you as their referring doctor. This does not create a BlinksMed account for you and does not share patient records.
              </td>
            </tr>
            <tr>
              <td style='padding: 0 28px 20px;'>
                <table role='presentation' cellpadding='0' cellspacing='0' border='0' width='100%' style='background-color: #f0fdfa; border: 1px solid #99f6e4;'>
                  <tr>
                    <td align='center' style='padding: 18px 16px 6px; font-family: Arial, Helvetica, sans-serif; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #0f766e; font-weight: bold;'>
                      Doctor Reference ID
                    </td>
                  </tr>
                  <tr>
                    <td align='center' style='padding: 0 16px 8px; font-family: Consolas, Monaco, monospace; font-size: 28px; line-height: 34px; font-weight: 700; letter-spacing: 0.04em; color: #134e4a;'>
                      {code}
                    </td>
                  </tr>
                  {specialty}
                  <tr><td style='height: 14px; line-height: 14px; font-size: 14px;'>&nbsp;</td></tr>
                </table>
              </td>
            </tr>
            {qrBlock}
            <tr>
              <td align='center' style='padding: 16px 28px 8px;'>
                <table role='presentation' cellpadding='0' cellspacing='0' border='0'>
                  <tr>
                    <td align='center' bgcolor='#0f766e' style='background-color: #0f766e;'>
                      <a href='{pageUrl}' style='display: inline-block; padding: 13px 28px; font-family: Arial, Helvetica, sans-serif; font-size: 15px; font-weight: bold; color: #ffffff; text-decoration: none;'>Open your patient share page</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align='center' style='padding: 0 28px 24px; font-family: Arial, Helvetica, sans-serif; font-size: 12px; line-height: 18px; color: #94a3b8; word-break: break-all;'>
                {pageUrl}
              </td>
            </tr>
            <tr>
              <td style='padding: 0 28px 20px;'>
                <table role='presentation' cellpadding='0' cellspacing='0' border='0' width='100%' style='background-color: #f8fafc; border: 1px solid #e2e8f0;'>
                  <tr>
                    <td style='padding: 16px 18px 8px; font-family: Arial, Helvetica, sans-serif; font-size: 14px; font-weight: bold; color: #0f172a;'>
                      How patients use this
                    </td>
                  </tr>
                  <tr>
                    <td style='padding: 0 18px 16px; font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 22px; color: #475569;'>
                      1. Share your ID <strong>{code}</strong> or show them the attached card.<br>
                      2. They place a medical equipment order on BlinksMed.<br>
                      3. At checkout they enter your ID (or scan the QR) as their doctor reference.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style='padding: 0 28px 8px; font-family: Arial, Helvetica, sans-serif; font-size: 13px; line-height: 20px; color: #64748b;'>
                If you did not expect this email, please write to
                <a href='mailto:{PublicSiteUrls.SupportEmail}' style='color: #0f766e; text-decoration: none;'>{PublicSiteUrls.SupportEmail}</a>.
              </td>
            </tr>
            <tr>
              <td style='padding: 16px 28px 28px; font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 22px; color: #334155;'>
                Warm regards,<br>
                <strong style='color: #0f172a;'>The BlinksMed Team</strong>
              </td>
            </tr>
            <tr>
              <td bgcolor='#f8fafc' style='padding: 16px 28px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; font-family: Arial, Helvetica, sans-serif; font-size: 11px; line-height: 17px; color: #94a3b8;'>
                This message was sent by BlinksMed because an administrator added your doctor reference profile. You can save the attached Doctor Reference Card for clinic display.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
</body>
</html>";
    }

    public static string NormalizeAuthPortal(string? portal)
    {
        var value = (portal ?? string.Empty).Trim().ToLowerInvariant();
        return value is "admin" or "customer" or "vendor" ? value : "";
    }

    public static string AuthPortalFromDisplayName(string? portal) =>
        NormalizeAuthPortal(portal) switch
        {
            "admin" => "BlinksMed Admin Portal",
            "customer" => "BlinksMed Customer Portal",
            _ => "BlinksMed Vendor Portal",
        };

    public static string PasswordReset(string resetLink, string? portal)
    {
        var fromName = WebUtility.HtmlEncode(AuthPortalFromDisplayName(portal));
        var kind = NormalizeAuthPortal(portal);
        var account = kind switch
        {
            "admin" => "admin",
            "customer" => "customer",
            _ => "vendor",
        };
        var headerBg = kind switch
        {
            "admin" => "#4c1d95",
            "customer" => "#0f766e",
            _ => "#2563eb",
        };
        var headerSub = kind switch
        {
            "admin" => "#ddd6fe",
            "customer" => "#ccfbf1",
            _ => "#dbeafe",
        };
        var safeLink = WebUtility.HtmlEncode(resetLink);
        var preview = $"Reset your {account} password. This link expires in 15 minutes.";

        return $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset='utf-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
    <meta http-equiv='X-UA-Compatible' content='IE=edge'>
    <title>Reset Your Password</title>
    <style type='text/css'>
      body, table, td, a {{ -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }}
      table, td {{ mso-table-lspace: 0pt; mso-table-rspace: 0pt; }}
    </style>
</head>
<body style='margin: 0; padding: 0; background-color: #eef2f6;'>
    <div style='display: none; max-height: 0; overflow: hidden; mso-hide: all;'>{WebUtility.HtmlEncode(preview)}</div>
    <table role='presentation' cellpadding='0' cellspacing='0' border='0' width='100%' style='background-color: #eef2f6;'>
      <tr>
        <td align='center' style='padding: 24px 12px;'>
          <table role='presentation' cellpadding='0' cellspacing='0' border='0' width='600' style='width: 100%; max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden;'>
            <tr>
              <td bgcolor='{headerBg}' style='padding: 28px 28px 24px; background-color: {headerBg};'>
                <p style='margin: 0 0 6px; font-family: Arial, Helvetica, sans-serif; font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; color: {headerSub}; font-weight: bold;'>BlinksMed</p>
                <h1 style='margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 24px; line-height: 32px; color: #ffffff; font-weight: 700;'>Password reset request</h1>
                <p style='margin: 10px 0 0; font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 22px; color: {headerSub};'>{fromName}</p>
              </td>
            </tr>
            <tr>
              <td style='padding: 28px; font-family: Arial, Helvetica, sans-serif; font-size: 16px; line-height: 24px; color: #334155;'>
                <p style='margin: 0 0 16px;'>You requested a password reset for your <strong>{account}</strong> account.</p>
                <p style='margin: 0 0 24px;'>Click the button below to choose a new password. This link expires in 15 minutes.</p>
                <table role='presentation' cellpadding='0' cellspacing='0' border='0' align='center' style='margin: 0 auto 24px;'>
                  <tr>
                    <td align='center' bgcolor='{headerBg}' style='border-radius: 8px; background-color: {headerBg};'>
                      <a href='{safeLink}' style='display: inline-block; padding: 14px 28px; font-family: Arial, Helvetica, sans-serif; font-size: 16px; font-weight: bold; color: #ffffff; text-decoration: none;'>Reset Password</a>
                    </td>
                  </tr>
                </table>
                <p style='margin: 0 0 8px; font-size: 13px; line-height: 20px; color: #64748b;'>If the button does not work, copy and paste this link into your browser:</p>
                <p style='margin: 0 0 24px; font-size: 12px; line-height: 18px; color: #2563eb; word-break: break-all;'><a href='{safeLink}' style='color: #2563eb; text-decoration: underline;'>{safeLink}</a></p>
                <p style='margin: 0 0 24px; font-size: 14px; color: #64748b;'>If you didn't request this, you can ignore this email. Your password will stay the same.</p>
                <p style='margin: 0; font-size: 14px; color: #64748b;'>Best regards,<br><strong style='color: #0f172a;'>{fromName}</strong></p>
              </td>
            </tr>
            <tr>
              <td style='padding: 16px 28px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; font-family: Arial, Helvetica, sans-serif; font-size: 11px; line-height: 17px; color: #94a3b8;'>
                This message was sent by {fromName}. For security, never share this link with anyone.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
</body>
</html>";
    }
}
