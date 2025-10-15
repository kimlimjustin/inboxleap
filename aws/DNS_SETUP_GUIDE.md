# DNS Setup Guide for AWS Deployment

## 🌐 Overview

Your AWS infrastructure is deployed, but domain validation is pending because your domain (`inboxleap.com`) is not yet pointing to AWS Route 53. This guide will walk you through setting up DNS properly.

## 📋 Current Status

After running Terraform, these services are waiting for DNS validation:
- ✅ **Infrastructure**: VPC, ECS, RDS, ALB all created successfully
- ⏳ **SSL Certificate**: Waiting for DNS validation to complete
- ⏳ **SES Domain**: Waiting for domain ownership verification
- ⏳ **Application**: Will work once SSL certificate is validated

## 🔍 Step 1: Get Your Route 53 Nameservers

First, let's get the nameservers that AWS assigned to your domain:

```powershell
cd aws\terraform
terraform output route53_name_servers
```

You should see output like:
```
[
  "ns-1234.awsdns-12.org",
  "ns-5678.awsdns-34.net", 
  "ns-9012.awsdns-56.com",
  "ns-3456.awsdns-78.co.uk"
]
```

**💡 Save these nameservers - you'll need them in the next step!**

## 🔧 Step 2: Update Your Domain Registrar

You need to update your domain registrar to use Route 53 nameservers. Here's how for common registrars:

### For GoDaddy:
1. Log into your GoDaddy account
2. Go to "My Products" → "DNS"
3. Find your domain `inboxleap.com`
4. Click "Change Nameservers"
5. Select "Custom" nameservers
6. Replace with the 4 Route 53 nameservers from Step 1
7. Save changes

### For Namecheap:
1. Log into Namecheap
2. Go to "Domain List"
3. Click "Manage" next to `inboxleap.com`
4. Go to "Nameservers" section
5. Select "Custom DNS"
6. Enter the 4 Route 53 nameservers
7. Save changes

### For Cloudflare:
1. Log into Cloudflare
2. Select your domain
3. Go to "DNS" → "Records"
4. Change nameservers to Route 53 ones
5. Save changes

### For Other Registrars:
Look for "DNS Management", "Nameservers", or "DNS Settings" in your registrar's control panel.

## ⏰ Step 3: Wait for DNS Propagation

After updating nameservers:
- **Propagation time**: 1-48 hours (usually 1-4 hours)
- **Check status**: Use online tools like `whatsmydns.net`

## 🔍 Step 4: Verify DNS Propagation

Check if your domain is pointing to AWS:

```powershell
# Check if your domain resolves to AWS
nslookup inboxleap.com

# Or use dig (if available)
dig inboxleap.com
```

You can also use online tools:
- https://www.whatsmydns.net/
- https://dnschecker.org/

Look for your domain to resolve to AWS Load Balancer IP addresses.

## 🚀 Step 5: Complete the Terraform Deployment

Once DNS is pointing to Route 53, complete the deployment:

```powershell
cd aws\terraform
terraform apply -auto-approve
```

This will:
- ✅ Complete SSL certificate validation
- ✅ Verify SES domain ownership  
- ✅ Enable HTTPS on your application
- ✅ Make your app accessible at https://inboxleap.com

## 🔍 Step 6: Check Deployment Status

Monitor the progress:

```powershell
# Check if certificate is validated
aws acm describe-certificate --certificate-arn $(terraform output -raw certificate_arn)

# Check SES domain status
aws ses get-identity-verification-attributes --identities inboxleap.com

# Check ECS services
aws ecs describe-services --cluster $(terraform output -raw ecs_cluster_name) --services inboxleap-production-backend inboxleap-production-frontend
```

## 🎯 Expected Timeline

| Step | Time Required |
|------|---------------|
| Update nameservers | 5 minutes |
| DNS propagation | 1-4 hours (max 48h) |
| Terraform completion | 5-10 minutes |
| **Total** | **1.5-4.5 hours** |

## 🚨 Troubleshooting

### Issue: DNS not propagating
**Solution**: 
- Wait longer (up to 48 hours)
- Check you entered all 4 nameservers correctly
- Contact your registrar if issues persist

### Issue: Certificate validation failing
**Solution**:
```powershell
# Check certificate status
aws acm describe-certificate --certificate-arn $(terraform output -raw certificate_arn) --query 'Certificate.DomainValidationOptions'
```

### Issue: SES verification failing
**Solution**:
```powershell
# Check SES verification status
aws ses get-identity-verification-attributes --identities inboxleap.com
```

## 🔄 Alternative: Manual DNS Records (If You Can't Change Nameservers)

If you can't change nameservers, you can manually add the required DNS records:

### 1. Get Required Records:
```powershell
cd aws\terraform
terraform show | grep -A 5 "route53_record"
```

### 2. Add These Records to Your Current DNS Provider:

**For SSL Certificate Validation:**
- Type: `CNAME`
- Name: `_acme-challenge.inboxleap.com`
- Value: (from Terraform output)

**For SES Verification:**
- Type: `TXT` 
- Name: `_amazonses.inboxleap.com`
- Value: (from Terraform output)

**For Application Access:**
- Type: `A` or `CNAME`
- Name: `inboxleap.com`
- Value: (ALB DNS name from Terraform output)

## ✅ Success Indicators

You'll know it's working when:

1. **DNS Resolution**: `nslookup inboxleap.com` returns AWS IPs
2. **SSL Certificate**: Shows as "Issued" in AWS Console
3. **SES Domain**: Shows as "Verified" in SES Console  
4. **Application**: Accessible at https://inboxleap.com

## 📞 Next Steps After DNS Setup

Once DNS is working:

1. **Build and Deploy Docker Images**:
   ```powershell
   # We'll do this after DNS is set up
   cd ..\..
   .\aws\scripts\build-and-deploy.ps1
   ```

2. **Configure Application Environment**:
   ```powershell
   .\aws\post-deploy.ps1 -Action ses-setup
   ```

3. **Test Your Application**:
   ```powershell
   .\aws\post-deploy.ps1 -Action health
   ```

## 💡 Pro Tips

- **Monitor Progress**: Use `terraform show` to see current resource states
- **Check Logs**: CloudWatch logs available even before full deployment
- **Test Incrementally**: Check each service as it comes online
- **Backup Plan**: Keep your original nameservers noted down

---

**🎉 Once DNS propagates, your application will be live at https://inboxleap.com!**
