const nodemailer = require('nodemailer');

async function main() {
  const transporter = nodemailer.createTransport({
    host: 'smtp.hostinger.com',
    port: 465,
    secure: true,
    auth: {
      user: 'support@neurqai.com',
      pass: 'Sp282002??'
    }
  });

  console.log('Verifying SMTP connection locally...');
  try {
    await transporter.verify();
    console.log('✅ SMTP connection successful!');
    
    console.log('Sending test email...');
    const info = await transporter.sendMail({
      from: 'QS Asset <support@neurqai.com>',
      to: 'smrita@neurqai.com',
      subject: 'Local Hostinger SMTP Test',
      html: '<p>If you see this, Hostinger SMTP is working perfectly from your machine!</p>'
    });
    console.log('✅ Email sent successfully!', info.messageId);
  } catch (error) {
    console.error('❌ Connection or sending failed:', error);
  }
}

main();
