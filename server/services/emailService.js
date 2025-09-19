const nodemailer = require('nodemailer');

// Configure o transporter de e-mail
// Em um ambiente de produção, use variáveis de ambiente para as credenciais
const transporter = nodemailer.createTransport({
    host: 'smtp.example.com', // Seu host SMTP
    port: 587,
    secure: false, // true para 465, false para outras portas
    auth: {
        user: 'your_email@example.com', // Seu e-mail
        pass: 'your_email_password' // Sua senha
    }
});

const sendInviteEmail = async (toEmail, inviteLink, projectName, inviterName, role) => {
    const mailOptions = {
        from: '"TaskFlow Pro" <no-reply@taskflowpro.com>', // Endereço do remetente
        to: toEmail, // Endereço do destinatário
        subject: 'Convite para colaborar no projeto TaskFlow Pro', // Assunto do e-mail
        html: `
            <p>Olá!</p>
            <p><strong>${inviterName}</strong> convidou você para colaborar no projeto <strong>${projectName}</strong> como <strong>${role}</strong>.</p>
            <p>Para aceitar o convite, clique no link abaixo:</p>
            <p><a href="${inviteLink}">Aceitar Convite</a></p>
            <p>Este link é válido por 7 dias.</p>
            <p>Se você não deseja participar deste projeto, pode ignorar este e-mail.</p>
            <p>Atenciosamente,</p>
            <p>Equipe TaskFlow Pro</p>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('Email de convite enviado para:', toEmail);
    } catch (error) {
        console.error('Erro ao enviar email de convite:', error);
        throw error;
    }
};

module.exports = { sendInviteEmail };