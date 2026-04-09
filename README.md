# Skull2Face AI — Backend

Full backend system for the Skull2Face AI forensic facial
reconstruction platform. Consists of two servers working together:
a Node.js REST API and a Python Flask AI service.

---

## System Architecture
Browser (Frontend)
↓ HTTP — port 5500
Node.js + Express Server — port 5000
↓ HTTP via SSH Tunnel
SSH Tunnel (localhost:8000 → DGX GPU Server:8000)
↓
Flask AI API — port 8000
↓
Stable Diffusion 1.5 + ControlNet on NVIDIA A100 GPU
↓ base64 PNG response
Back through the same chain to Browser

---

## Part 1 — Node.js Server

Handles authentication, case management, file storage, and
communication between the frontend and the AI service.

### Tech Stack

| Package | Purpose |
|---------|---------|
| express | REST API framework |
| mongoose | MongoDB object modeling |
| bcryptjs | Password hashing |
| jsonwebtoken | JWT authentication |
| multer | Skull X-ray file upload handling |
| axios | HTTP calls to Flask AI service |
| cors | Cross-origin request handling |
| dotenv | Environment variable management |
| nodemon | Auto-restart on code changes |

### API Routes
POST   /api/auth/login                    Login
POST   /api/auth/register                 Register investigator
GET    /api/user/me                       Get own profile
PUT    /api/user/profile                  Update profile
POST   /api/reconstruct/upload            Submit case + X-rays
GET    /api/reconstruct/history           Get case history
GET    /api/reconstruct/download/:id      Download result
GET    /api/admin/cases                   All cases (admin)
DELETE /api/admin/cases/:id               Delete case (admin)
GET    /api/admin/users                   All investigators (admin)
PATCH  /api/admin/users/:id/toggle        Toggle active status (admin)
GET    /api/admin/stats                   System statistics (admin)
GET    /api/admin/logs                    Activity logs (admin)

### Database — MongoDB

Three collections:

- `users` — credentials, roles, profile info, department, avatar
- `reconstructions` — case ID, skull images, traits, output, status
- `logs` — system events (login, submit, complete, delete)

### How to Run
```bash
cd server
npm install
# Create .env file (see .env.example)
npm run dev
```

Required `.env` variables:
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
AI_SERVICE_URL=http://localhost:8000
PORT=5000

---

## Part 2 — Flask AI Service

Python Flask API running on a college DGX GPU server.
Handles all deep learning inference.

### Hardware

- 8x NVIDIA A100-SXM4-40GB GPUs
- CUDA 12.2
- NVIDIA DGX Server

### AI Pipeline

Receive skull X-rays (frontal + lateral) as base64
Decode and preprocess images
SkullEncoder CNN → 128-dimensional skull embedding + gender detection
SkullControlNet → spatial skull structure features
ConditioningProjector → fuse skull features with trait hints
Stable Diffusion 1.5 UNet → DDIM sampling (75 steps)
Generate 5 seed variations → select best by quality score
GFPGAN → face enhancement and noise removal
Return result as base64 PNG


### Trained Models

| File | Size | Purpose |
|------|------|---------|
| skull_encoder_best.pth | 45MB | Skull CNN encoder |
| controlnet_ultimate.pth | 14MB | ControlNet weights |

> Model weights are not included in this repository due to file size.
> They are stored on the DGX GPU server.
> Contact the repository owner for access.

### Python Dependencies
flask
flask-cors
torch==2.1
diffusers==0.37.1
transformers
opencv-python
pillow
gfpgan

### How to Run (on GPU server)
```bash
conda activate gfpgan
cd forensic_reconstruction/web
python app.py
```

Access via SSH tunnel from local machine:
```bash
ssh -L 8000:localhost:8000 username@server_ip -N
```

---

## Dataset

This project uses the IIT Mandi Skull-to-Face dataset:
[rspnikhil/IIT_Mandi_S2F](https://github.com/rspnikhil/IIT_Mandi_S2F)

- 51 skull X-ray pairs (frontal + lateral)
- 128-dimensional ArcFace face embeddings
- Augmented to 19,278 training pairs using custom pipeline
- Combined with CelebA (200k faces) for two-stage training

If you use this dataset please cite:
@misc{prasad2025fcrinvestigatinggenerativeai,
title={FCR: Investigating Generative AI models for
Forensic Craniofacial Reconstruction},
author={Ravi Shankar Prasad and Dinesh Singh},
year={2025},
eprint={2508.18031},
archivePrefix={arXiv},
primaryClass={cs.CV},
url={https://arxiv.org/abs/2508.18031}
}

---

## Security

- Passwords hashed with bcryptjs (salt rounds: 10)
- JWT tokens with 7 day expiry
- Admin-only middleware on all `/api/admin/*` routes
- Role-based redirection on login
- SSH tunnel for secure GPU server communication

---

## Related Repositories

- Frontend: [skull2face-frontend](https://github.com/sssamridhi/skull2face-frontend)

---
# Skull2Face AI — Setup Guide

## Requirements

### System Requirements
- Node.js v18+ 
- Python 3.9+
- MongoDB Community Server
- Git
- NVIDIA GPU (for AI model — A100 recommended)

---

## Backend Setup (Node.js)

### 1. Clone the repo
```bash
git clone https://github.com/sssamridhi/skull2face-backend.git
cd skull2face-backend/server
```

### 2. Install Node packages
```bash
npm install
```

### 3. Create .env file
Create a file called `.env` inside the `server/` folder:
```
MONGO_URI=mongodb://localhost:27017/skull2face
JWT_SECRET=your_super_secret_key_here
AI_SERVICE_URL=http://localhost:8000
PORT=5000
```

### 4. Seed the database (creates admin + user accounts)
```bash
node seed.js
```

### 5. Start the server
```bash
npm run dev
```

Server runs on **http://localhost:5000**

---

## AI Service Setup (Python/Flask on DGX)

### 1. Activate gfpgan environment
```bash
conda activate gfpgan
```

### 2. Install Python requirements
```bash
pip install -r requirements.txt
```

### 3. Run Flask API
```bash
cd /home/ffr/forensic_reconstruction
CUDA_VISIBLE_DEVICES=4 python web/app.py
```

Flask API runs on **http://0.0.0.0:8000**

---

## SSH Tunnel (connect your PC to DGX)

Run this in a terminal on your PC and keep it open:
```bash
ssh -L 8000:localhost:8000 ffr@172.16.40.56
```

This tunnels your PC's port 8000 to the DGX server.

---

## Frontend Setup

### 1. Clone the repo
```bash
git clone https://github.com/sssamridhi/skull2face-frontend.git
```

### 2. Open with Live Server
- Open VS Code
- Install **Live Server** extension
- Right click `login.html` → **Open with Live Server**

---

## Full Startup Order (every time)

```
1. mongod                          ← start MongoDB
2. cd server && npm run dev        ← start Node server  
3. ssh -L 8000:localhost:8000 ...  ← SSH tunnel (keep open)
4. conda activate gfpgan           ← on DGX
5. python web/app.py               ← start Flask on DGX
6. Open login.html with Live Server
```

---

## Demo Credentials

| Role | Username | Password |
|------|----------|----------|
| Admin | admin | admin123 |
| Investigator | user | user123 |

---


## Project Context

Developed as a B.Tech final year group project at Banasthali Vidyapith.

The AI pipeline addresses a real challenge in forensic investigation —
reconstructing a face from skeletal remains when no other identification
is available. The system is designed to assist investigators, not replace
forensic experts.
