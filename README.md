# Ceres: Custom Document Renderer

![Ceres Logo/Banner Placeholder] Ceres is a dynamic, client-side document rendering application designed to fetch data from an API and populate a specified template to generate custom documents like invoices, receipts, or reports. Built with a focus on flexibility and ease of integration, Ceres allows you to display data in a visually appealing and structured manner without complex server-side rendering setups.

## 🌟 Features

- **Dynamic Template Loading:** Load different HTML templates based on a URL parameter.
- **API Data Integration:** Fetch and consume JSON data from any specified external API endpoint.
- **Handlebars Templating:** Utilizes the powerful Handlebars library for efficient templating with helpers and enhanced logic support.
- **Client-Side Rendering:** All rendering occurs in the user's browser, reducing server load and improving responsiveness.
- **Base64 Encoded API URLs:** Securely pass API endpoints via URL parameters using Base64 encoding.
- **Customizable Data Mapping:** A flexible `mapDataToTemplateModel` function allows you to transform raw API responses into a structured model perfectly suited for your templates.
- **Error Handling:** Robust error reporting for missing parameters, invalid templates, and API fetch failures.
- **Modular Structure:** Separate `index.html`, `app.js`, and `style.css` for clean code organization.
- **Template-Specific Styling:** Each document template can have its own dedicated CSS file for unique designs.

## 🚀 Getting Started

Follow these steps to set up and run Ceres locally.

### Prerequisites

- A web server (e.g., Node.js `http-server`, Python's `SimpleHTTPServer`, Apache, Nginx) to serve static files.
- Node.js and npm (if using `http-server`).

### Installation

1.  **Clone the Repository (or create the files):**
    If you have a Git repository, clone it:

    ```bash
    git clone <your-repository-url>
    cd ceres-document-renderer # Or whatever your root folder is called
    ```

    Otherwise, ensure your project structure matches:

    ```
    ceres/
    ├── index.html
    ├── app.js
    ├── style.css
    └── basic-invoice-example/  # Example template directory
        ├── template.html
        └── styles.css
    ```

2.  **Install `http-server` (if not already installed):**
    This is a simple zero-configuration command-line http server.
    ```bash
    npm install -g http-server
    ```

### Running the Application

1.  **Navigate to your project root:**
    Open your terminal or command prompt and go to the `ceres/` directory (where `index.html`, `app.js` reside).

    ```bash
    cd path/to/your/ceres/
    ```

2.  **Start the Web Server:**

    ```bash
    http-server -p 1337
    ```

    This will start a server on `http://localhost:1337`. You can choose any available port.

3.  **Construct Your URL:**
    Ceres requires two primary URL parameters: `template` and `apiUrl`.

    - **`template`**: The name of the template directory (e.g., `basic-invoice-example`).
    - **`apiUrl`**: A Base64 encoded version of your API endpoint.

    **Example API URL:**
    Let's say your Refrens API URL is:
    `https://api.refrens.com/invoices/66d6801b41c663befb2c7492?_at=rndici6UoMcyC6TKbd&copy&populateBusiness=true`

    To Base64 encode it in your browser's console:

    ```javascript
    btoa(
      "[https://api.refrens.com/invoices/66d6801b41c663befb2c7492?_at=rndici6UoMcyC6TKbd&copy&populateBusiness=true](https://api.refrens.com/invoices/66d6801b41c663befb2c7492?_at=rndici6UoMcyC6TKbd&copy&populateBusiness=true)"
    );
    // This will output something like: "aHR0cHMlM0ElMkYlMkZhcGkucmVmcmVucy5jb20lMkZpbnZvaWNlcyUyRjY2ZDY4MDFiNDFjNjYzYmVmYjJjNzQ5MiUzRn9hdCUzRHJuZGljaTZVb01jeUM2VEtiZCUyNnNjb3B5JTI2cG9wdWxhdGVCdXNpbmVzcyUzRHRydWU="
    ```

    **Your final browser URL will look like this:**

    ```
    http://localhost:1337/index.html?template=basic-invoice-example&apiUrl=aHR0cHMlM0ElMkYlMkZhcGkucmVmcmVucy5jb20lMkZpbnZvaWNlcyUyRjY2ZDY4MDFiNDFjNjYzYmVmYjJjNzQ5MiUzRn9hdCUzRHJuZGljaTZVb01jeUM2VEtiZCUyNnNjb3B5JTI2cG9wdWxhdGVCdXNpbmVzcyUzRHRydWU=
    ```

4.  **Open in Browser:** Paste the constructed URL into your web browser.

## 📁 Project Structure
