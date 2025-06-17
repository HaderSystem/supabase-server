# ⚙️ Hader Supabase Server

This is the backend service for the **Hader – Smart Attendance System**, handling:
- Student & Teacher account creation
- Face image uploads to Supabase Storage
- Email password delivery (via Gmail)
- Integration with Supabase database and storage

---

## 🚀 Features

- 📦 Upload student/teacher face images
- ✉️ Send login credentials via email (using Gmail SMTP)
- 🔐 Store metadata and authentication info in Supabase
- 🔄 Communicates with Flutter frontend via REST API

---

## 🛠️ Tech Stack

| Layer         | Tech/Service                       |
|---------------|------------------------------------|
| Runtime       | Node.js (Express.js)               |
| Auth/Storage  | Supabase (Service Role Key)        |
| Email Service | Nodemailer (Gmail SMTP)            |
| Image Upload  | Multer + Supabase Storage          |

---


### 1. Clone the repository

```bash
git clone https://github.com/HaderSystem/supabase-server.git
cd supabase-server
