# PipelineSentry 🛡️ | Local CI/CD Pipeline Simulator & Chaos Engineering Grid

PipelineSentry is an interactive, full-stack Internal Developer Platform (IDP) engineered to shift-left CI/CD pipeline validation. Instead of pushing code to remote repositories and waiting for cloud runners to execute workflows, PipelineSentry parses GitHub Actions configurations, maps them into a visual node graph, and runs them locally or inside an isolated AWS staging environment. 

Crucially, PipelineSentry includes a **Chaos Engineering Layer** that allows developers to inject network bottlenecks (packet loss, latency) or compute resource exhaustion directly into active build/test containers via a real-time UI control panel, auditing pipeline resiliency before code ever touches production branches.

---

## 🏗️ System Architecture & Workflow

PipelineSentry decouples the interactive presentation layer from the underlying container orchestration engine to maintain high performance and real-time responsiveness.

```
                ┌──────────────────────────────────────────┐
                │            NEXT.JS FRONTEND              │
                │   - Visual Node Canvas (React Flow)      │
                │   - Chaos Toggles & Live Console Deck    │
                └──────────────────────────────────────────┘
                             ▲              │
        HTTP Upload (YAML)   │              │   WebSocket Events (Chaos Trigger)
        & Telemetry Pull     │              ▼
                ┌──────────────────────────────────────────┐
                │          FASTAPI BACKEND ENGINE          │
                │   - Workflow Compiler & YAML Parser      │
                │   - Streaming Log Multiplexer Socket     │
                └──────────────────────────────────────────┘
                              ▲              │
        Docker Socket Logs    │              │   Unix CLI Network Shaping
          (stdout/stderr)     │              ▼
                ┌──────────────────────────────────────────┐
                │       ISOLATED RUNTIME RUNNER (AWS EC2)  │
                │   - [Docker: Node Job Container]         │
                │   - [Docker: Python Test Container]      │
                └──────────────────────────────────────────┘

```

### Infrastructure Workflow Execution
1. **Compilation Phase:** The user uploads or pastes a standard GitHub Actions `.yml` file through the Next.js portal. The FastAPI backend translates the YAML blocks into a structured dependency JSON mapping configuration.
2. **Visual Ingestion:** The Next.js frontend uses the JSON to draw an interactive DAG (Directed Acyclic Graph) showing execution pathways.
3. **Execution & Live Telemetry:** Clicking "Run Simulation" commands FastAPI to talk to the Docker daemon on the host node. Jobs are dynamically spun up as temporary containers. Standard input/output buffers (`stdout`/`stderr`) are bound to a persistent WebSocket that pipes live execution strings straight to the UI console.
4. **Chaos Insertion:** Toggling a network latency option sends an event down the socket. The backend wraps `tc` (Traffic Control) commands into the targeted container runtime namespace, intentionally choking bandwidth to test step timeout boundaries.

---

## 🛠️ The DevOps & Cloud Tech Stack

| Layer | Component | Core Technology | Strategic Purpose |
| :--- | :--- | :--- | :--- |
| **Frontend UI** | Client Portal | **Next.js 14+ (App Router)** | Powers the interactive UI, tracking execution state, file uploads, and terminal emulation components. |
| **Frontend Graphics** | Pipeline Visualizer | **React Flow** | Renders complex DAG pipeline files into modular, draggable interactive nodes and edge tracks. |
| **Backend Core** | Automation Engine | **FastAPI (Python)** | Manages high-performance asynchronous execution context, file streaming parsing (`PyYAML`), and background tasks. |
| **Real-time Pipeline** | Logging & Control | **WebSockets (Native)** | Multiplexes continuous terminal output sequences and real-time chaos command packets with sub-millisecond lag. |
| **Isolation Layer** | Task Execution | **Docker Engine API** | Standardizes build and test parameters using isolated image footprints on the hosting cluster. |
| **Cloud Computing** | Hosting Node | **AWS EC2 (Ubuntu Core)** | Acts as the main application host, running the core system backend and hosting the parent Docker socket engine. |
| **Static Delivery** | Public Landing | **AWS Amplify** | Distributes and optimizes the static frontend bundle via automated continuous delivery connected directly to the GitHub repo. |

---

## 📁 Repository Directory Structure

```
pipelinesentry/
├── frontend-ui/               # Next.js Application Core
│   ├── components/            # React Flow Canvas, Console Terminal, Control Panel
│   ├── app/                   # App Router Pages & Stylesheets
│   └── package.json           # Frontend Client Dependencies
├── backend-engine/            # FastAPI Python Application Core
│   ├── core/                  # YAML Compilation Engines & Data Parser
│   ├── routers/               # WebSocket Controllers & REST Endpoints
│   ├── main.py                # Main Application Entrypoint
│   └── requirements.txt       # Python Dependencies (docker-py, PyYAML)
└── deployments/               # Infrastructure Configuration
    ├── Dockerfile             # Production Backend Multi-Stage Configuration
    └── docker-compose.yml     # Local Orchestration Config for Fast Staging

```

### Step-by-Step Installation & Local Execution

Prerequisites

Ensure your local system or AWS EC2 node has Docker Desktop or Docker Engine installed and running natively.

```
Python 3.10+ and Node.js 18+ installed on your workspace.
```

1. Setup the Backend Engine

Navigate into the backend root:

```
cd backend-engine
```

Create and source a virtual isolation space:

```
python3 -m venv venv

 venv\Scripts\activate
```

Install package requirements:

```
pip install -r requirements.txt
```

Fire up the local Uvicorn environment:

```
uvicorn main:app --reload --port 8000
```

2. Setup the Next.js Frontend UI

Shift over to the frontend root directory:

```
cd ../frontend-ui
```

Install client-side component dependencies:

```
npm install
```

Start the development server context:

```
npm run dev
```

Access the workspace application portal by launching your browser and navigating to http://localhost:3000.

### 🛡️ Chaos Scripting Reference
PipelineSentry maps graphical control UI triggers to exact system shell parameters executing at the execution core layer. For example, triggering a network degradation packet executes:

```
docker exec -it <active_runner_container_id> tc qdisc add dev eth0 root netem delay 250ms loss 10%
```

This forces the target workspace build step environment to process network dependencies under simulated unoptimized 3G cellular network grids, verifying deployment pipeline durability.

###⚖️ License & Compliance

Developed entirely from scratch for the AWS Summer Builder Cohort 2026. Codebase rules follow standard open-source technical licensing policies. Plagiarism checks apply.
