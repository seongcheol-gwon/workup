# Automation Monorepo

This is a monorepo for an automation tool that helps users interact with and analyze data from spreadsheet files using natural language prompts. The primary feature, "Sheet Sense," leverages AI to process and provide insights from user-uploaded Excel files.

The project consists of:
- A Kotlin/Spring Boot backend that handles file processing, AI integration, and the GraphQL API.
- A Next.js/React frontend that provides the user interface for uploading files and interacting with the AI.

## Features

- **AI-Powered Spreadsheet Analysis**: Use natural language prompts to ask questions about your Excel data.
- **Multiple File Uploads**: Upload and analyze data from several spreadsheet files at once.
- **Password-Protected File Support**: Securely provide passwords to process encrypted Excel files.
- **Dynamic Prompt Builder**: Easily insert references to specific sheets and columns into your prompt.
- **Sheet & Column Inspection**: Automatically detects and displays sheets and columns from your files.
- **Save & Reuse Prompts**: Save your frequently used prompts for future use.
- **Two Processing Modes**: Choose between a detailed, human-readable output ("Detail Mode") or a structured JSON output ("JSON Mode").

## Tech Stack

### Backend
- **Framework**: Spring Boot 3
- **Language**: Kotlin
- **API**: GraphQL (with Spring for GraphQL & Netflix DGS)
- **AI Integration**: Spring AI with AWS Bedrock
- **Database**: H2 (In-memory)
- **Spreadsheet Processing**: Apache POI

### Frontend
- **Framework**: Next.js 13
- **Language**: TypeScript
- **UI Library**: React, Ant Design
- **State Management/API**: Apollo Client for GraphQL
- **Spreadsheet Parsing**: `xlsx` (SheetJS)

## Getting Started

### Prerequisites

- Java 17 or later
- Node.js and npm
- An AWS account with credentials configured for Bedrock access.

### Installation & Running

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd automation-monorepo
    ```

2.  **Run the Backend Server:**
    Open a terminal and run the following command from the project root:
    ```bash
    ./gradlew bootRun
    ```
    The backend server will start on port 8080.

3.  **Run the Frontend Application:**
    Open a second terminal and run the following commands from the project root:
    ```bash
    npm install
    npm run dev
    ```
    The frontend development server will start on port 3000.

4.  **Access the application:**
    Open your browser and navigate to `http://localhost:3000`.

## Usage

The main feature of this application is "Sheet Sense," accessible from the home page.

1.  **Upload Files**: Drag and drop one or more `.xls` or `.xlsx` files onto the upload area.
2.  **Enter Passwords**: If a file is password-protected, an input field will appear. Enter the password to unlock the file and view its sheets.
3.  **Inspect Sheets and Columns**: The application will display the sheets and their columns for each uploaded file.
4.  **Write a Prompt**: In the "Prompt" text area, write your request in natural language.
5.  **Use Placeholders (Optional)**: You can click on a sheet name or a column name to insert a placeholder (e.g., `{Sheet1}`, `{Sheet1:Revenue}`) into your prompt. This helps the AI accurately reference your data.
6.  **Choose a Mode**:
    -   **Detail Mode**: Provides a descriptive, narrative answer.
    -   **JSON Mode**: Returns a structured JSON response, suitable for programmatic use.
7.  **Run and Get Results**: Click the "Run" button. The AI will process your request, and the result will appear below.
8.  **Save Your Prompt (Optional)**: If you plan to reuse the prompt, give it a name and click "Save".
