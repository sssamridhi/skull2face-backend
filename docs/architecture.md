# Skull2Face AI â€” Architecture

```text
+-------------------------+
| Investigator / Admin UI |
| HTML + CSS + JavaScript |
+-----------+-------------+
            |
            | HTTP
            v
+-------------------------+
| Node.js / Express API   |
| - Authentication        |
| - Case management       |
| - Upload handling       |
| - Admin routes          |
| - MongoDB integration   |
+------+------------------+
       |                 |
       |                 | HTTP
       v                 v
+-------------+    +--------------------+
|   MongoDB   |    | Flask AI Service   |
| users/cases |    | /health            |
| logs        |    | /reconstruct       |
+-------------+    +----------+---------+
                              |
                              | Internal college network
                              v
                    +----------------------+
                    | GPU Reconstruction   |
                    | Pipeline             |
                    | - feature extraction |
                    | - conditioning       |
                    | - diffusion          |
                    | - enhancement        |
                    +----------+-----------+
                               |
                               v
                    Reconstructed face output
```

## Why the inference service is not public

The reconstruction pipeline is coupled to a college-hosted GPU environment and is accessible only from the institution''s network. The repository therefore documents the complete software architecture while leaving the restricted inference infrastructure private.

