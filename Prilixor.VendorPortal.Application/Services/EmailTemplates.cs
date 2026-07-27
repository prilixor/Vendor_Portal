namespace Prilixor.VendorPortal.Application.Services;

public static class EmailTemplates
{
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

    /// <param name="qrCodeDataUri">Optional data URI (e.g. data:image/png;base64,...) for inline QR.</param>
    public static string DoctorShareInvite(
        string doctorName,
        string uniqueCode,
        string sharePageUrl,
        string? specialization = null,
        string? qrCodeDataUri = null)
    {
        var name = string.IsNullOrWhiteSpace(doctorName) ? "Doctor" : doctorName.Trim();
        var specialtyLine = string.IsNullOrWhiteSpace(specialization)
            ? ""
            : $"<p style='margin: 4px 0 0; font-size: 14px; color: #64748b;'>{specialization.Trim()}</p>";

        var qrBlock = string.IsNullOrWhiteSpace(qrCodeDataUri)
            ? ""
            : $@"
            <div style='text-align: center; margin: 28px 0 8px;'>
                <p style='font-size: 13px; color: #64748b; margin: 0 0 12px; text-transform: uppercase; letter-spacing: 0.06em;'>Your patient QR code</p>
                <div style='display: inline-block; padding: 16px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;'>
                    <img src='{qrCodeDataUri}' alt='Doctor QR Code' width='200' height='200' style='display: block; width: 200px; height: 200px;' />
                </div>
                <p style='font-size: 12px; color: #94a3b8; margin: 10px 0 0;'>Patients can scan this to open your BlinksMed profile</p>
            </div>";

        return $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset='utf-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
    <title>Your BlinksMed Doctor ID</title>
</head>
<body style='margin: 0; padding: 0; background: #f1f5f9; font-family: Arial, Helvetica, sans-serif; line-height: 1.6; color: #0f172a;'>
    <div style='max-width: 600px; margin: 0 auto; padding: 24px 16px;'>
        <div style='background: linear-gradient(135deg, #0f766e 0%, #115e59 55%, #134e4a 100%); padding: 32px 24px; border-radius: 16px 16px 0 0; text-align: center;'>
            <p style='margin: 0 0 8px; color: #99f6e4; font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; font-weight: bold;'>BlinksMed</p>
            <h1 style='color: #ffffff; margin: 0; font-size: 26px; font-weight: 700;'>Your Doctor Reference ID</h1>
            <p style='margin: 10px 0 0; color: #ccfbf1; font-size: 15px;'>Share with patients when they order on BlinksMed</p>
        </div>
        <div style='background: #ffffff; padding: 28px 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 16px 16px;'>
            <p style='font-size: 16px; margin: 0 0 16px;'>Dear {name},</p>
            <p style='font-size: 15px; margin: 0 0 20px; color: #334155;'>
                Your doctor profile is ready on BlinksMed. Patients can use your Unique ID or scan your QR code to add you as their doctor reference on orders.
            </p>

            <div style='background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 12px; padding: 18px 16px; text-align: center; margin: 0 0 20px;'>
                <p style='margin: 0; font-size: 12px; color: #0f766e; text-transform: uppercase; letter-spacing: 0.08em; font-weight: bold;'>Unique ID</p>
                <p style='margin: 8px 0 0; font-size: 28px; font-family: Consolas, Monaco, monospace; font-weight: 700; color: #134e4a; letter-spacing: 0.06em;'>{uniqueCode}</p>
                {specialtyLine}
            </div>

            {qrBlock}

            <div style='text-align: center; margin: 28px 0 8px;'>
                <a href='{sharePageUrl}' style='display: inline-block; background: #0f766e; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: bold;'>Open your share page</a>
            </div>
            <p style='font-size: 12px; color: #94a3b8; text-align: center; word-break: break-all; margin: 0 0 24px;'>{sharePageUrl}</p>

            <div style='background: #f8fafc; border-radius: 10px; padding: 16px; margin: 0 0 20px;'>
                <p style='margin: 0 0 8px; font-size: 14px; font-weight: bold; color: #0f172a;'>How to share with patients</p>
                <ol style='margin: 0; padding-left: 18px; font-size: 14px; color: #475569;'>
                    <li style='margin-bottom: 6px;'>Show or send them your Unique ID <strong>{uniqueCode}</strong></li>
                    <li style='margin-bottom: 6px;'>Or let them scan the QR code above</li>
                    <li>They enter the ID at checkout when placing a BlinksMed order</li>
                </ol>
            </div>

            <p style='font-size: 13px; color: #64748b; margin: 0;'>If you did not expect this email, please contact BlinksMed support.</p>
            <p style='font-size: 14px; color: #64748b; margin: 24px 0 0;'>Warm regards,<br><strong style='color: #0f172a;'>The BlinksMed Team</strong></p>
        </div>
    </div>
</body>
</html>";
    }
}
