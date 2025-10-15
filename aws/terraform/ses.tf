# SES Domain Identity
resource "aws_ses_domain_identity" "main" {
  domain = var.domain_name
}

# SES Domain Verification Record
resource "aws_route53_record" "ses_verification" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "_amazonses.${var.domain_name}"
  type    = "TXT"
  ttl     = 600
  records = [aws_ses_domain_identity.main.verification_token]
}

# SES Domain Identity Verification
resource "aws_ses_domain_identity_verification" "main" {
  domain = aws_ses_domain_identity.main.id

  depends_on = [aws_route53_record.ses_verification]
}

# SES DKIM
resource "aws_ses_domain_dkim" "main" {
  domain = aws_ses_domain_identity.main.domain
}

# SES DKIM Records
resource "aws_route53_record" "ses_dkim" {
  count   = 3
  zone_id = aws_route53_zone.main.zone_id
  name    = "${aws_ses_domain_dkim.main.dkim_tokens[count.index]}._domainkey"
  type    = "CNAME"
  ttl     = 600
  records = ["${aws_ses_domain_dkim.main.dkim_tokens[count.index]}.dkim.amazonses.com"]
}

# SES Mail From Domain
resource "aws_ses_domain_mail_from" "main" {
  domain           = aws_ses_domain_identity.main.domain
  mail_from_domain = "mail.${var.domain_name}"
}

# MX Record for Mail From Domain
resource "aws_route53_record" "ses_mail_from_mx" {
  zone_id = aws_route53_zone.main.zone_id
  name    = aws_ses_domain_mail_from.main.mail_from_domain
  type    = "MX"
  ttl     = 600
  records = ["10 feedback-smtp.${var.aws_region}.amazonses.com"]
}

# TXT Record for Mail From Domain
resource "aws_route53_record" "ses_mail_from_txt" {
  zone_id = aws_route53_zone.main.zone_id
  name    = aws_ses_domain_mail_from.main.mail_from_domain
  type    = "TXT"
  ttl     = 600
  records = ["v=spf1 include:amazonses.com ~all"]
}

# SES Configuration Set
resource "aws_ses_configuration_set" "main" {
  name = "${local.name_prefix}-config-set"

  delivery_options {
    tls_policy = "Require"
  }
}

# SES Event Destination for CloudWatch
resource "aws_ses_event_destination" "cloudwatch" {
  name                   = "cloudwatch"
  configuration_set_name = aws_ses_configuration_set.main.name
  enabled                = true
  matching_types         = ["send", "reject", "bounce", "complaint", "delivery"]

  cloudwatch_destination {
    default_value  = "default"
    dimension_name = "MessageTag"
    value_source   = "messageTag"
  }
}

# DMARC Record
resource "aws_route53_record" "dmarc" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "_dmarc.${var.domain_name}"
  type    = "TXT"
  ttl     = 600
  records = ["v=DMARC1; p=quarantine; rua=mailto:dmarc@${var.domain_name}; ruf=mailto:dmarc@${var.domain_name}; sp=quarantine; adkim=r; aspf=r"]
}

# S3 Bucket for storing incoming emails
resource "aws_s3_bucket" "email_storage" {
  bucket = "${local.name_prefix}-email-storage"
}

resource "aws_s3_bucket_versioning" "email_storage" {
  bucket = aws_s3_bucket.email_storage.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "email_storage" {
  bucket = aws_s3_bucket.email_storage.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "email_storage" {
  bucket = aws_s3_bucket.email_storage.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# IAM role for SES to access S3
resource "aws_iam_role" "ses_s3_role" {
  name = "${local.name_prefix}-ses-s3-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ses.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "ses_s3_policy" {
  name = "${local.name_prefix}-ses-s3-policy"
  role = aws_iam_role.ses_s3_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:PutObjectAcl"
        ]
        Resource = "${aws_s3_bucket.email_storage.arn}/*"
      }
    ]
  })
}

# Lambda function for email webhook processing (no auto-reply)
resource "aws_iam_role" "lambda_webhook_role" {
  name = "${local.name_prefix}-lambda-webhook-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "lambda_webhook_policy" {
  name = "${local.name_prefix}-lambda-webhook-policy"
  role = aws_iam_role.lambda_webhook_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject"
        ]
        Resource = "${aws_s3_bucket.email_storage.arn}/*"
      }
    ]
  })
}

# Lambda function for webhook processing only (auto-reply removed)
resource "aws_lambda_function" "email_webhook_processor" {
  filename      = "email_webhook_processor.zip"
  function_name = "${local.name_prefix}-email-webhook-processor"
  role          = aws_iam_role.lambda_webhook_role.arn
  handler       = "index.handler"
  runtime       = "python3.9"
  timeout       = 30

  # Pass config to Lambda for processing
  environment {
    variables = {
      EMAIL_BUCKET   = aws_s3_bucket.email_storage.bucket
      EMAIL_PREFIX   = "incoming-emails/"
      DOMAIN_NAME    = var.domain_name
      BACKEND_URL    = "https://${var.domain_name}"
      WEBHOOK_SECRET = var.ses_webhook_secret
    }
  }

  source_code_hash = data.archive_file.email_webhook_processor_zip.output_base64sha256
}

# Create the Lambda function code (webhook only, no auto-reply)
data "archive_file" "email_webhook_processor_zip" {
  type        = "zip"
  output_path = "email_webhook_processor.zip"
  source {
    content = <<EOF
import json
import os
import boto3
import urllib3
from email.parser import Parser

s3_client = boto3.client('s3')
http = urllib3.PoolManager()

BUCKET = os.environ.get('EMAIL_BUCKET')
PREFIX = os.environ.get('EMAIL_PREFIX', '')
DOMAIN_NAME = os.environ.get('DOMAIN_NAME')
BACKEND_URL = os.environ.get('BACKEND_URL', 'https://inboxleap.com')
WEBHOOK_SECRET = os.environ.get('WEBHOOK_SECRET', 'your-webhook-secret')

def parse_email_content(raw_email):
    """Parse raw email content and extract structured data"""
    try:
        parser = Parser()
        parsed_email = parser.parsestr(raw_email)
        
        # Extract basic headers
        subject = parsed_email.get('Subject', 'No Subject')
        from_addr = parsed_email.get('From', '')
        to_addrs = parsed_email.get('To', '').split(',') if parsed_email.get('To') else []
        cc_addrs = parsed_email.get('Cc', '').split(',') if parsed_email.get('Cc') else []
        bcc_addrs = parsed_email.get('Bcc', '').split(',') if parsed_email.get('Bcc') else []
        date_header = parsed_email.get('Date', '')
        
        # Clean up addresses
        to_addrs = [addr.strip() for addr in to_addrs if addr.strip()]
        cc_addrs = [addr.strip() for addr in cc_addrs if addr.strip()]
        bcc_addrs = [addr.strip() for addr in bcc_addrs if addr.strip()]
        
        # Extract body content
        body = ""
        if parsed_email.is_multipart():
            for part in parsed_email.walk():
                if part.get_content_type() == "text/plain":
                    body = part.get_payload(decode=True).decode('utf-8', errors='replace')
                    break
                elif part.get_content_type() == "text/html" and not body:
                    body = part.get_payload(decode=True).decode('utf-8', errors='replace')
        else:
            body = parsed_email.get_payload(decode=True).decode('utf-8', errors='replace')
        
        # Extract thread headers
        headers = {
            'in-reply-to': parsed_email.get('In-Reply-To'),
            'references': parsed_email.get('References'),
            'message-id': parsed_email.get('Message-ID')
        }
        
        return {
            'subject': subject,
            'from': from_addr,
            'to': to_addrs,
            'cc': cc_addrs,
            'bcc': bcc_addrs,
            'body': body,
            'date': date_header,
            'headers': headers
        }
    except Exception as e:
        print(f"Error parsing email: {e}")
        return None

def send_to_backend(email_data, message_id):
    """Send parsed email data to backend webhook"""
    try:
        payload = {
            'messageId': message_id,
            'subject': email_data['subject'],
            'from': email_data['from'],
            'to': email_data['to'],
            'cc': email_data['cc'],
            'bcc': email_data['bcc'],
            'body': email_data['body'],
            'date': email_data['date'],
            'headers': email_data['headers']
        }
        
        webhook_url = f"{BACKEND_URL}/api/inbound/email"
        
        response = http.request(
            'POST',
            webhook_url,
            body=json.dumps(payload).encode('utf-8'),
            headers={
                'Content-Type': 'application/json',
                'X-Auth-Token': WEBHOOK_SECRET
            },
            timeout=30
        )
        
        if response.status == 200:
            print(f"Successfully sent email to backend: {message_id}")
            return True
        else:
            print(f"Backend returned status {response.status}: {response.data.decode('utf-8', errors='replace')}")
            return False
            
    except Exception as e:
        print(f"Error sending to backend: {e}")
        return False

def handler(event, context):
    # Log the entire event for troubleshooting
    print('SES event:', json.dumps(event))

    # Get the message from the SES event
    ses_mail = event['Records'][0]['ses']['mail']
    message_id = ses_mail['messageId']

    # Parse recipients to get all destinations
    destinations = ses_mail.get('destination', [])

    # Read stored email from S3 and send to backend webhook
    try:
        s3_key = f"{PREFIX}{message_id}"
        obj = s3_client.get_object(Bucket=BUCKET, Key=s3_key)
        raw_email = obj['Body'].read().decode('utf-8', errors='replace')
        print(f"Fetched email from s3://{BUCKET}/{s3_key}, size={len(raw_email)} bytes")
        
        # Parse email content
        email_data = parse_email_content(raw_email)
        if email_data:
            # Send to backend for processing
            backend_success = send_to_backend(email_data, message_id)
            print(f"Backend webhook: {'Success' if backend_success else 'Failed'}")
        else:
            print("Failed to parse email content")
            
    except Exception as e:
        print(f"Failed to fetch/process email from S3: {e}")

    # Note: Auto-reply functionality removed - backend handles replies via Postmark

    return {
        'statusCode': 200,
        'body': json.dumps({
            'message': 'Email processed and sent to backend webhook',
            'messageId': message_id,
            'recipients': destinations,
            's3Key': f"{PREFIX}{message_id}",
        })
    }
EOF
    filename = "index.py"
  }
}

# Lambda permission for SES to invoke the webhook function
resource "aws_lambda_permission" "ses_invoke_webhook_lambda" {
  statement_id   = "AllowExecutionFromSES"
  action         = "lambda:InvokeFunction"
  function_name  = aws_lambda_function.email_webhook_processor.function_name
  principal      = "ses.amazonaws.com"
  source_account = data.aws_caller_identity.current.account_id
}

# SES Receipt Rule Set
resource "aws_ses_receipt_rule_set" "main" {
  rule_set_name = "${local.name_prefix}-rule-set"
}

# Activate the rule set
resource "aws_ses_active_receipt_rule_set" "main" {
  rule_set_name = aws_ses_receipt_rule_set.main.rule_set_name
}

# SES Receipt Rule for incoming emails (S3 storage + webhook processing)
resource "aws_ses_receipt_rule" "store_and_process" {
  name          = "${local.name_prefix}-store-and-process"
  rule_set_name = aws_ses_receipt_rule_set.main.rule_set_name
  recipients    = [var.domain_name, "mail.${var.domain_name}"]
  enabled       = true
  scan_enabled  = true

  # Store email in S3
  s3_action {
    bucket_name       = aws_s3_bucket.email_storage.bucket
    object_key_prefix = "incoming-emails/"
    position          = 1
  }

  # Trigger Lambda for webhook processing (no auto-reply)
  lambda_action {
    function_arn    = aws_lambda_function.email_webhook_processor.arn
    invocation_type = "Event"
    position        = 2
  }

  depends_on = [
    aws_s3_bucket_policy.ses_s3_policy,
    aws_lambda_permission.ses_invoke_webhook_lambda
  ]
}

# S3 bucket policy to allow SES to write emails
resource "aws_s3_bucket_policy" "ses_s3_policy" {
  bucket = aws_s3_bucket.email_storage.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowSESPuts"
        Effect = "Allow"
        Principal = {
          Service = "ses.amazonaws.com"
        }
        Action   = "s3:PutObject"
        Resource = "${aws_s3_bucket.email_storage.arn}/*"
        Condition = {
          StringEquals = {
            "aws:Referer" = data.aws_caller_identity.current.account_id
          }
        }
      }
    ]
  })
}

# MX Record for incoming email
resource "aws_route53_record" "mx" {
  zone_id = aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = "MX"
  ttl     = 600
  records = ["10 inbound-smtp.${var.aws_region}.amazonaws.com"]
}
