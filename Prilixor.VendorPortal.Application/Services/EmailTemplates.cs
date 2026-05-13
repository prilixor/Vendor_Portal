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
            <p style='font-size: 14px; color: #666; margin-top: 30px;'>Best regards,<br>The Prilixor Team</p>
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
                <a href='https://vendor-portal-psi-amber.vercel.app/vendor' style='background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-size: 16px; font-weight: bold;'>Go to Dashboard</a>
            </div>
            <p style='font-size: 14px; color: #666; margin-top: 30px;'>If you have any questions, please contact our support team.</p>
            <p style='font-size: 14px; color: #666;'>Best regards,<br>The Prilixor Team</p>
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
            <p style='font-size: 14px; color: #666; margin-top: 30px;'>Best regards,<br>The Prilixor Team</p>
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
            <p style='font-size: 14px; color: #666; margin-top: 30px;'>Best regards,<br>The Prilixor Team</p>
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
            <p style='font-size: 14px; color: #666; margin-top: 30px;'>Best regards,<br>The Prilixor Team</p>
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
                <a href='https://vendor-portal-psi-amber.vercel.app/vendor' style='background: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-size: 16px; font-weight: bold;'>Go to Dashboard</a>
            </div>
            <p style='font-size: 14px; color: #666; margin-top: 30px;'>Best regards,<br>The Prilixor Team</p>
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
            <p style='font-size: 14px; color: #666; margin-top: 30px;'>Best regards,<br>The Prilixor Team</p>
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
            <p style='font-size: 14px; color: #666; margin-top: 30px;'>Best regards,<br>The Prilixor Team</p>
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
            <p style='font-size: 14px; color: #666; margin-top: 30px;'>Best regards,<br>The Prilixor Team</p>
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
            <p style='font-size: 14px; color: #666; margin-top: 30px;'>Best regards,<br>The Prilixor Team</p>
        </div>
    </div>
</body>
</html>";
    }
}
