﻿const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');
const fs = require('fs');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Multer setup (face image upload)
const upload = multer({ dest: 'uploads/' });

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
    },
});

// Generate a secure random password
function generatePassword(length = 6) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#\$%&';
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// Create Student API
app.post('/create_student_server', upload.single('face_image'), async (req, res) => {
    const { email, name, role } = req.body;
    const imageFile = req.file;

    if (!email || !name || !role || !imageFile) {
        return res.status(400).json({ error: 'Missing fields or image' });
    }

    const password = generatePassword();

    try {
        // 1. Create user in Supabase Auth
        const { data, error } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name: name, role },
        });

        if (error) return res.status(500).json({ error: error.message });

        const userId = data.user.id;

        // 2. Upload image to Supabase Storage (faces)
        const imageBuffer = fs.readFileSync(imageFile.path);
        const imageName = `${userId}.jpg`;

        const { error: uploadError } = await supabase.storage
            .from('faces')
            .upload(imageName, imageBuffer, {
                contentType: 'image/jpeg',
                upsert: true,
            });

        if (uploadError) return res.status(500).json({ error: uploadError.message });

        // 3. Create a signed URL valid for 7 days
        const { data: signedData, error: signedError } = await supabase
            .storage
            .from('faces')
            .createSignedUrl(imageName, 60 * 60 * 24 * 7); // 7 أيام

        if (signedError) return res.status(500).json({ error: signedError.message });

        const signedUrl = signedData.signedUrl;

        // 4. Insert student data into the database
        const { data: insertData, error: insertError } = await supabase
            .from('students')
            .insert([{ id: userId, name, email, role, faces: signedUrl }])
            .select();

        if (insertError) return res.status(500).json({ error: insertError.message });

        const studentId = insertData[0].student_id;

        // Update user metadata to include student_id
await supabase.auth.admin.updateUserById(userId, {
    user_metadata: {
        full_name: name,
        role,
        student_id: studentId 
    }
});

        //  Send email to student
        await transporter.sendMail({
            from: 'hadersystem@gmail.com',
            to: email,
            subject: 'Your Student Account Created',
            text: `Hello ${name}, \nYour student account has been created.\n\nEmail: ${email}\nPassword: ${password}\n\nPlease log in and change your password.\n\n- Hader System`,
        });


        fs.unlinkSync(imageFile.path);

        return res.json({
            message: 'Student created successfully',
            userId,
            studentId,
            password,
        });
    } catch (err) {
        console.error('Server error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
});





app.delete('/delete_user/:id', async (req, res) => {
    const userId = req.params.id;

    try {
       
        // حذف من جدول الطلاب أو المعلمين
        await supabase.from('students').delete().eq('id', userId); // لو كان طالب
       
     await supabase.from('teachers').delete().eq('id', userId); // لو كان معلم
     
 // حذف من Supabase Auth
        await supabase.auth.admin.deleteUser(userId);

        res.status(200).json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('❌ Error deleting user:', error);
        res.status(500).json({ error: error.message });
    }
});


// Start server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
