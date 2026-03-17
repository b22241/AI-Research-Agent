# 🚀 AWS Deployment Guide — AI Research Agent

Complete step-by-step guide to deploy the AI Research Agent on AWS (S3 + EC2).

---

## 📋 Prerequisites

- AWS account
- Project running locally
- `.pem` key file saved at `D:\ai-research-agent-key.pem`
- Groq API key and Tavily API key ready

---

## 🗂️ Architecture

```
User Browser
     │
     ▼
S3 Static Website (Frontend - React)
     │
     │ HTTP requests to port 8000
     ▼
EC2 Instance (Backend - FastAPI + LangGraph)
     │
     ├── Tavily API (web search)
     └── Groq API (LLaMA 3 LLM)
```

---

## PART 1 — Deploy Frontend to S3

### Step 1 — Create S3 Bucket

1. Go to [console.aws.amazon.com](https://console.aws.amazon.com)
2. Search **S3** → click **Create bucket**
3. Fill in:
   - **Bucket name:** `ai-research-agent-frontend`
   - **Region:** `ap-south-1` (Mumbai)
   - **Uncheck** "Block all public access"
   - Check the confirmation checkbox
4. Click **Create bucket**

---

### Step 2 — Enable Static Website Hosting

1. Click your bucket → **Properties** tab
2. Scroll to **Static website hosting** → **Edit**
3. Select **Enable**
4. **Index document:** `index.html`
5. **Error document:** `index.html`
6. Click **Save changes**

---

### Step 3 — Add Bucket Policy

1. Go to **Permissions** tab → **Bucket policy** → **Edit**
2. Paste this (replace `ai-research-agent-frontend` if your bucket name is different):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::ai-research-agent-frontend/*"
    }
  ]
}
```

3. Click **Save changes**

---

### Step 4 — Set EC2 URL in Frontend

Before building, update the API URL to point to your EC2 instance.

Open `frontend/.env`:

```
VITE_API_URL=http://YOUR_EC2_PUBLIC_IP:8000
```

Replace `YOUR_EC2_PUBLIC_IP` with your actual EC2 IP (e.g. `13.126.31.239`).

---

### Step 5 — Build Frontend Locally

Open PowerShell and run:

```bash
cd D:\PP\AI-Research-Agent\frontend
npm run build
```

You should see a `dist/` folder created with:
```
dist/
├── index.html
└── assets/
    ├── index-xxx.js
    ├── index-xxx.css
    └── ...
```

---

### Step 6 — Upload to S3

Since AWS CLI is not installed, upload via AWS Console:

1. Go to S3 → `ai-research-agent-frontend` → **Upload**
2. Click **Add files** → navigate to `D:\PP\AI-Research-Agent\frontend\dist` → select `index.html` → Open
3. Click **Add folder** → select the `assets` folder from `dist` → Upload
4. Click **Upload**

✅ All files should show **Succeeded** status.

---

### Step 7 — Get Frontend URL

1. Go to **Properties** tab → scroll to **Static website hosting**
2. Copy the **Bucket website endpoint**

It looks like:
```
http://ai-research-agent-frontend.s3-website.ap-south-1.amazonaws.com
```

---

## PART 2 — Deploy Backend to EC2

### Step 8 — Create AWS Access Keys

1. Go to AWS Console → click your account name (top right) → **Security credentials**
2. Scroll to **Access keys** → **Create access key**
3. Select **CLI** → check confirmation → **Next** → **Create**
4. **Download the CSV** — save `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`

---

### Step 9 — Launch EC2 Instance

1. Go to AWS Console → search **EC2** → **Launch Instance**
2. Fill in:
   - **Name:** `ai-research-agent-backend`
   - **AMI:** Amazon Linux 2023 (free tier)
   - **Instance type:** `t3.micro` (free tier)
3. **Key pair** → **Create new key pair**:
   - Name: `ai-research-agent-key`
   - Type: `RSA`
   - Format: `.pem`
   - Click **Create key pair** — it auto-downloads
4. **Network settings** → **Edit** → Add these inbound rules:

| Type | Protocol | Port | Source |
|---|---|---|---|
| SSH | TCP | 22 | 0.0.0.0/0 |
| Custom TCP | TCP | 8000 | 0.0.0.0/0 |

5. Click **Launch Instance**
6. Go to **EC2 → Instances** → copy the **Public IPv4 address**

---

### Step 10 — Fix .pem File Permissions

The `.pem` file must be moved off OneDrive and have strict permissions:

```bash
# Copy to D drive (away from OneDrive)
copy "C:\Users\nayan\Downloads\ai-research-agent-key.pem" "D:\ai-research-agent-key.pem"

# Strip all inherited permissions
icacls "D:\ai-research-agent-key.pem" /inheritance:r

# Remove group permissions
icacls "D:\ai-research-agent-key.pem" /remove "NT AUTHORITY\Authenticated Users"
icacls "D:\ai-research-agent-key.pem" /remove "BUILTIN\Users"

# Grant only your user read access (replace 'nayan' with your Windows username)
icacls "D:\ai-research-agent-key.pem" /grant:r "nayan:R"

# Verify — should show only your username
icacls "D:\ai-research-agent-key.pem"
```

Expected output:
```
D:\ai-research-agent-key.pem FREESOUL\nayan:(R)
Successfully processed 1 files; Failed processing 0 files
```

---

### Step 11 — SSH into EC2

```bash
ssh -i "D:\ai-research-agent-key.pem" ec2-user@YOUR_EC2_IP
```

Replace `YOUR_EC2_IP` with your actual IP (e.g. `13.126.31.239`).

Type `yes` when asked about authenticity. You should see:

```
   ,     #_
   ~\_  ####_        Amazon Linux 2023
  ~~  \_#####\
[ec2-user@ip-172-xx-xx-xx ~]$
```

---

### Step 12 — Install Dependencies on EC2

Run these commands inside EC2 one by one:

```bash
# Update system packages
sudo dnf update -y

# Install Python and Git
sudo dnf install -y python3 python3-pip git

# Install Node.js
sudo dnf install -y nodejs

# Install PM2 (process manager)
sudo npm install -g pm2
```

---

### Step 13 — Create Project Structure on EC2

```bash
mkdir ai-research-agent
cd ai-research-agent
mkdir backend

# Create Python virtual environment
python3 -m venv venv
source venv/bin/activate
```

---

### Step 14 — Upload Backend Files

**Open a NEW PowerShell terminal** (keep SSH open) and run:

```bash
# Upload agent.py
scp -i "D:\ai-research-agent-key.pem" "D:\PP\AI-Research-Agent\backend\agent.py" ec2-user@YOUR_EC2_IP:/home/ec2-user/ai-research-agent/backend/

# Upload main.py
scp -i "D:\ai-research-agent-key.pem" "D:\PP\AI-Research-Agent\backend\main.py" ec2-user@YOUR_EC2_IP:/home/ec2-user/ai-research-agent/backend/

# Generate and upload requirements.txt
cd D:\PP\AI-Research-Agent\backend
..\venv\Scripts\activate
pip freeze > requirements.txt

scp -i "D:\ai-research-agent-key.pem" "D:\PP\AI-Research-Agent\backend\requirements.txt" ec2-user@YOUR_EC2_IP:/home/ec2-user/ai-research-agent/backend/
```

---

### Step 15 — Install Python Packages on EC2

Go back to your **SSH terminal** and run:

```bash
cd /home/ec2-user/ai-research-agent
source venv/bin/activate

# Install all packages (without strict versioning)
pip install langgraph langchain langchain-community langchain-groq langchain-core tavily-python fastapi uvicorn python-dotenv pydantic
```

This takes 2-3 minutes.

---

### Step 16 — Create .env File on EC2

```bash
cat > /home/ec2-user/ai-research-agent/backend/.env << 'EOF'
GROQ_API_KEY=your_groq_api_key_here
TAVILY_API_KEY=your_tavily_api_key_here
EOF
```

Replace with your actual keys. Verify it was created:

```bash
cat /home/ec2-user/ai-research-agent/backend/.env
```

---

### Step 17 — Start Backend with PM2

```bash
cd /home/ec2-user/ai-research-agent/backend

# Start the FastAPI server
pm2 start "uvicorn main:app --host 0.0.0.0 --port 8000" --name ai-research-agent

# Save PM2 process list (auto-restart on reboot)
pm2 save

# Enable PM2 to start on system boot
pm2 startup
```

---

### Step 18 — Verify Backend is Running

```bash
# Check PM2 status
pm2 status

# Test health endpoint
curl http://localhost:8000/health
```

Expected output:
```json
{"status":"ok"}
```

Also test from your browser:
```
http://YOUR_EC2_IP:8000/health
```

---

### Step 19 — Test Full Application

Open your S3 frontend URL in browser:
```
http://ai-research-agent-frontend.s3-website.ap-south-1.amazonaws.com
```

Ask a question like **"What is LangGraph?"** — you should see:
- Intent badge (📚 Factual)
- Streaming response token by token
- Source cards with credibility scores
- Confidence percentage

---

## PART 3 — CI/CD with GitHub Actions

### Step 20 — Push to GitHub

```bash
cd D:\PP\AI-Research-Agent

# Initialize git
git init
git add .
git commit -m "Initial commit - AI Research Agent"

# Create repo on github.com then:
git remote add origin https://github.com/YOUR_USERNAME/ai-research-agent.git
git branch -M main
git push -u origin main
```

---

### Step 21 — Create Workflow Files

```bash
mkdir .github
mkdir .github\workflows
```

Create `frontend.yml`:

```bash
notepad .github\workflows\frontend.yml
```

```yaml
name: Deploy Frontend to S3

on:
  push:
    branches: [main]
    paths:
      - "frontend/**"

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "18"

      - name: Install dependencies
        working-directory: frontend
        run: npm install

      - name: Build
        working-directory: frontend
        env:
          VITE_API_URL: ${{ secrets.VITE_API_URL }}
        run: npm run build

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ap-south-1

      - name: Sync to S3
        run: aws s3 sync frontend/dist s3://${{ secrets.S3_BUCKET_NAME }} --delete
```

Create `backend.yml`:

```bash
notepad .github\workflows\backend.yml
```

```yaml
name: Deploy Backend to EC2

on:
  push:
    branches: [main]
    paths:
      - "backend/**"

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to EC2 via SSH
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ec2-user
          key: ${{ secrets.EC2_SSH_KEY }}
          script: |
            cd /home/ec2-user/ai-research-agent
            git pull origin main
            source venv/bin/activate
            pip install -r backend/requirements.txt
            pm2 restart ai-research-agent
            pm2 save
```

---

### Step 22 — Add GitHub Secrets

Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Add these one by one:

| Secret Name | Value |
|---|---|
| `VITE_API_URL` | `http://YOUR_EC2_IP:8000` |
| `AWS_ACCESS_KEY_ID` | Your AWS access key |
| `AWS_SECRET_ACCESS_KEY` | Your AWS secret key |
| `S3_BUCKET_NAME` | `ai-research-agent-frontend` |
| `EC2_HOST` | Your EC2 public IP e.g. `13.126.31.239` |
| `EC2_SSH_KEY` | Full contents of your `.pem` file |
| `GROQ_API_KEY` | Your Groq API key |
| `TAVILY_API_KEY` | Your Tavily API key |

To get the contents of your `.pem` file:
```bash
type "D:\ai-research-agent-key.pem"
```
Copy everything including `-----BEGIN RSA PRIVATE KEY-----` and `-----END RSA PRIVATE KEY-----`.

---

### Step 23 — Push CI/CD Files

```bash
cd D:\PP\AI-Research-Agent
git add .
git commit -m "Add GitHub Actions CI/CD workflows"
git push
```

---

## 🔄 How CI/CD Works After Setup

```
You make changes locally
        ↓
git add . && git commit -m "update" && git push
        ↓
GitHub Actions triggers automatically
        ↓
frontend/** changed? → npm build → deploy to S3
backend/**  changed? → SSH into EC2 → git pull → pm2 restart
        ↓
Live in ~2 minutes. Zero manual work.
```

---

## 🛠️ Useful Commands

### EC2 Management

```bash
# SSH into EC2
ssh -i "D:\ai-research-agent-key.pem" ec2-user@YOUR_EC2_IP

# Check backend status
pm2 status

# View backend logs
pm2 logs ai-research-agent

# Restart backend
pm2 restart ai-research-agent

# Stop backend
pm2 stop ai-research-agent

# Test health endpoint
curl http://localhost:8000/health
```

### Local Development

```bash
# Start backend
cd D:\PP\AI-Research-Agent\backend
..\venv\Scripts\activate
uvicorn main:app --reload --port 8000

# Start frontend
cd D:\PP\AI-Research-Agent\frontend
npm run dev
```

### Re-deploy Frontend Manually

```bash
# Rebuild
cd D:\PP\AI-Research-Agent\frontend
npm run build

# Upload to S3 via AWS Console:
# S3 → ai-research-agent-frontend → Delete all → Upload dist/ contents
```

### Re-deploy Backend Manually

```bash
# Upload changed files
scp -i "D:\ai-research-agent-key.pem" "D:\PP\AI-Research-Agent\backend\agent.py" ec2-user@YOUR_EC2_IP:/home/ec2-user/ai-research-agent/backend/
scp -i "D:\ai-research-agent-key.pem" "D:\PP\AI-Research-Agent\backend\main.py" ec2-user@YOUR_EC2_IP:/home/ec2-user/ai-research-agent/backend/

# SSH in and restart
ssh -i "D:\ai-research-agent-key.pem" ec2-user@YOUR_EC2_IP
pm2 restart ai-research-agent
```

---

## ⚠️ Common Issues & Fixes

### SSH: Bad permissions on .pem file
```bash
icacls "D:\ai-research-agent-key.pem" /inheritance:r
icacls "D:\ai-research-agent-key.pem" /remove "NT AUTHORITY\Authenticated Users"
icacls "D:\ai-research-agent-key.pem" /remove "BUILTIN\Users"
icacls "D:\ai-research-agent-key.pem" /grant:r "nayan:R"
```

### SSH: Connection timed out
- Go to EC2 → Security Groups → Edit inbound rules
- Make sure port 22 has source `0.0.0.0/0`

### Frontend: Failed to fetch
- Go to EC2 → Security Groups → Edit inbound rules
- Make sure port 8000 has source `0.0.0.0/0`
- Verify backend is running: `pm2 status`
- Test: `http://YOUR_EC2_IP:8000/health`

### Backend: ModuleNotFoundError
```bash
source venv/bin/activate
pip install langgraph langchain langchain-community langchain-groq langchain-core tavily-python fastapi uvicorn python-dotenv pydantic
pm2 restart ai-research-agent
```

### Backend crashed after reboot
```bash
pm2 startup
pm2 save
```

---

## 📦 Project URLs

| Service | URL |
|---|---|
| Frontend | `http://ai-research-agent-frontend.s3-website.ap-south-1.amazonaws.com` |
| Backend Health | `http://YOUR_EC2_IP:8000/health` |
| Backend API | `http://YOUR_EC2_IP:8000/ask` |
| Backend Stream | `http://YOUR_EC2_IP:8000/ask/stream` |

---

## 👤 Author

**Suman**
IIT Mandi
[GitHub](https://github.com/YOUR_USERNAME) · [LinkedIn](https://linkedin.com/in/YOUR_USERNAME)