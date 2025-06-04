const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

// Multer setup (face image upload)
const upload = multer({ dest: 'uploads/' });

// Supabase setup
const supabase = createClient(
    'https://gnorslgqghumwmgoqwhk.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdub3JzbGdxZ2h1bXdtZ29xd2hrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTIzMDUzNSwiZXhwIjoyMDYwODA2NTM1fQ.ybht5pNxY4QC4dHMGGOD-Rj66LATISW5N9DiHMNLeIs'

);

// Email setup
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'hadersystem@gmail.com',
        pass: 'etmfpsahknesrejo',
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

        // 5. Send email to student
        await transporter.sendMail({
            from: 'hadersystem@gmail.com',
            to: email,
            subject: 'Your Student Account Created',
            text: `Hello ${name}, \nYour student account has been created.\n\nEmail: ${email}\nPassword: ${password}\n\nPlease log in and change your password.\n\n- Hader System`,
        });

        // 6. Clean up local uploaded file
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

// Start server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
