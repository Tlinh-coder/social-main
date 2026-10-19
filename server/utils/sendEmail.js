const sendEmail = async ({ email, html, subject }) => {
  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": process.env.BREVO_API_KEY, // Vẫn dùng biến môi trường API Key này
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: {
          name: "HL social",
          email: "trinhhuylong9304@gmail.com", // BẮT BUỘC thay bằng đúng Gmail bạn đã xác thực trên Brevo
        },
        to: [{ email: email }],
        subject: subject,
        htmlContent: html,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(JSON.stringify(errorData));
    }

    const data = await response.json();
    console.log("Email đã gửi thành công qua Brevo API trực tiếp!");
    return data;
  } catch (error) {
    console.error("Lỗi khi gửi email:", error);
    throw error;
  }
};

module.exports = sendEmail;
