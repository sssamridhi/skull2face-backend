# Skull2Face AI

Skull2Face AI is an academic prototype for AI-assisted forensic facial reconstruction from skull X-ray inputs. The project was developed as a B.Tech final-year group project at Banasthali Vidyapith.

> **Important:** This project is not a public-facing forensic service and is not intended for operational identification or legal decision-making. The reconstruction pipeline depends on a college-hosted GPU environment that is accessible only within the institution''s network.

## System Overview

The project is organized as a single repository containing three components:

```text
Investigator / Admin Interface
            |
            v
      Frontend (HTML/CSS/JS)
            |
            v
   Node.js + Express REST API
      |                 |
      v                 v
   MongoDB        Flask AI Service
                       |
                       v
              GPU-hosted ML Pipeline
                       |
                       v
              Reconstructed Face
```

## Repository Structure

```text
skull2face/
â”œâ”€â”€ frontend/               # Investigator/admin web interface
â”‚   â”œâ”€â”€ index.html
â”‚   â”œâ”€â”€ login.html
â”‚   â”œâ”€â”€ dashboard.html
â”‚   â”œâ”€â”€ admin-dashboard.html
â”‚   â”œâ”€â”€ *.css
â”‚   â”œâ”€â”€ *.js
â”‚   â””â”€â”€ assets/
â”œâ”€â”€ server/                 # Node.js + Express application layer
â”‚   â”œâ”€â”€ config/
â”‚   â”œâ”€â”€ middleware/
â”‚   â”œâ”€â”€ models/
â”‚   â”œâ”€â”€ routes/
â”‚   â”œâ”€â”€ index.js
â”‚   â”œâ”€â”€ package.json
â”‚   â””â”€â”€ .env.example
â”œâ”€â”€ ai-service/             # Flask inference API
â”‚   â”œâ”€â”€ app.py
â”‚   â””â”€â”€ requirements.txt
â”œâ”€â”€ docs/
â”‚   â””â”€â”€ architecture.md
â”œâ”€â”€ .gitignore
â””â”€â”€ README.md
```

## What the System Does

The interface supports two user roles:

- **Investigator** â€” submit a case, upload frontal/lateral skull X-rays, provide optional profile hints, view previous cases, and download results.
- **Administrator** â€” manage users and cases, review system activity, and view dashboard statistics.

The Node.js server handles authentication, case management, database access, uploads, and communication with the AI service.

The Flask service receives skull images and profile hints, forwards them to the reconstruction pipeline running on the college GPU server, and returns the generated reconstruction to the application layer.

## AI Pipeline

The current research pipeline includes:

- skull-image preprocessing
- CNN-based skull feature extraction
- learned spatial conditioning
- diffusion-based facial reconstruction
- multiple candidate generations
- post-processing / face enhancement

The model weights and full training environment are not included in this repository because the inference stack is hosted on college GPU infrastructure.

## Dataset

The project uses the IIT Mandi Skull-to-Face dataset as part of the experimental pipeline. The original dataset contains a very small number of paired skull/face samples, so the training workflow also includes a custom augmentation strategy to increase training diversity.

See the original project documentation and cited dataset/research sources for complete attribution.

## Backend

The application layer uses:

- Node.js
- Express
- MongoDB / Mongoose
- JWT authentication
- bcrypt password hashing
- Multer for uploads
- Axios for service-to-service communication

### Run the Node server

```bash
cd server
npm install
cp .env.example .env
npm run dev
```

Configure the local `.env` with your own environment-specific values.

## AI Service

The AI service uses Flask and the deep-learning dependencies listed in:

```text
ai-service/requirements.txt
```

The service is environment-specific and currently depends on the college-hosted GPU setup. It is therefore **not expected to run as a normal public deployment**.

## Frontend

The frontend is implemented with HTML, CSS, and vanilla JavaScript.

For local interface development, you can open the `frontend/` directory using a local web server such as VS Code Live Server.

## Security and Privacy

- Do not commit `.env` files, passwords, tokens, or database credentials.
- Do not commit real forensic records or sensitive case images.
- Demo data should be synthetic or explicitly authorized.
- The project should be treated as a research/academic prototype rather than a validated forensic identification tool.

## Deployment Status

The public repository is intended to document and demonstrate the system architecture and implementation.

The full AI inference service is **not publicly deployed** because it requires restricted access to the college GPU environment and is not intended for general public use.

## Project Context

Developed as a final-year B.Tech Computer Science Engineering group project at Banasthali Vidyapith.

