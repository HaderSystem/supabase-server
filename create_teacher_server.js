const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const nodemailer = require('nodemailer');

require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Supabase setup
const supabase = createClient(
     process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

// Email setup
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
   user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
    }
});

// Generate random password
function generatePassword(length = 6) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#';
    let password = '';
    for (let i = 0; i < length; i++) {
        password += chars[Math.floor(Math.random() * chars.length)];
    }
    return password;
}

// Endpoint to create teacher
app.post('/create_teacher_server', async (req, res) => {
    const { email, name } = req.body;

    if (!email || !name) {
        return res.status(400).json({ error: 'Missing email or name' });
    }

    const password = generatePassword();

    try {
        // Create user in Supabase Auth
        const { data, error } = await supabase.auth.admin.createUser({
            email,
            password,
            user_metadata: {
                name: name,
                role: 'teacher'
            },
            email_confirm: true
        });

        if (error) {
            console.error('Create user error:', error);
            return res.status(500).json({ error: error.message });
        }

        const userId = data.user.id;

        // Insert teacher data into database
        const { error: insertError } = await supabase
            .from('teachers')
            .insert([{ id: userId, email, name: name }]);

        if (insertError) {
            console.error('Insert error:', insertError);
            return res.status(500).json({ error: insertError.message });
        }

        // Get generated employee_id
        const { data: teacherRow, error: fetchError } = await supabase
            .from('teachers')
            .select('employee_id')
            .eq('id', userId)
            .single();

        if (fetchError) {
            console.error('Fetch employee_id error:', fetchError);
            return res.status(500).json({ error: fetchError.message });
        }

        const employeeId = teacherRow.employee_id;
        
        //  Update user metadata with employee_id
const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
  user_metadata: {
    name,
    role: 'teacher',
    employee_id: employeeId
  }
});

if (updateError) {
  console.error('Metadata update error:', updateError);
  return res.status(500).json({ 
    error: 'Failed to update user metadata', 
    details: updateError 
  });
}



        // Send email with employee ID
        const mailOptions = {
            from: 'hadersystem@gmail.com',
            to: email,
            subject: 'Your Teacher Account Created',
            text: `Hello ${name},

Your teacher account has been created.

Email: ${email}
Password: ${password}
Employee ID: ${employeeId}

Please login and change your password.

- Hader System`
        };

        await transporter.sendMail(mailOptions);

        res.json({ teacherId: userId, employeeId, password });
    } catch (e) {
        console.error('Unexpected error:', e);
        res.status(500).json({ error: 'Unexpected server error' });
    }
});


//turn on server
const PORT = 3001;
app.listen(PORT, () => {
    console.log(`✅ Teacher server with email running on port ${PORT}`);
});





