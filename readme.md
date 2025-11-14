# OnlyOffice Web

🌐 **Live Demo**: https://ranuts.github.io/document/

[English](readme.md) | [中文](readme.zh.md)

A local web-based document editor based on OnlyOffice, allowing you to edit documents directly in your browser without server-side processing, ensuring your privacy and security.

## ✨ Key Features

- 🔒 **Privacy-First**: All document processing happens locally in your browser, with no uploads to any server
- 📝 **Multi-Format Support**: Supports DOCX, XLSX, PPTX, and many other document formats
- ⚡ **Real-Time Editing**: Provides smooth real-time document editing experience
- 🚀 **No Server Required**: Pure frontend implementation with no server-side processing needed
- 🎯 **Ready to Use**: Start editing documents immediately by opening the webpage

## 🛠️ Technical Architecture

This project is built on the following core technologies:

- **OnlyOffice SDK**: Provides powerful document editing capabilities
- **WebAssembly**: Implements document format conversion through x2t-wasm
- **Pure Frontend Architecture**: All functionality runs in the browser

## 📖 Usage

### Basic Usage

1. Visit the [Online Editor](https://ranuts.github.io/document/)
2. Upload your document files
3. Edit directly in your browser
4. Download the edited documents

### As a Component Library

This project also provides foundational services for document preview components in the [@ranui/preview](https://www.npmjs.com/package/@ranui/preview) WebComponent library.

📚 **Preview Component Documentation**: [https://chaxus.github.io/ran/src/ranui/preview/](https://chaxus.github.io/ran/src/ranui/preview/)

## 🚀 Deployment

- **Auto Deployment**: The project is automatically deployed to GitHub Pages when changes are pushed to the main branch
- **Manual Deployment**: You can also deploy the project to any static website hosting service

### docker run

```bash
docker run -d --name document -p 8080:8080 ghcr.io/ranui/document:latest
```

### docker compose

```yaml
services:
  document:
    image: ghcr.io/ranui/document:latest
    container_name: document
    ports:
      - 8080:8080
```

## 🔧 Local Development

```bash
# Clone the repository
git clone https://github.com/ranuts/document.git

# Navigate to the project directory
cd document

# Install dependencies
npm install

# Start local development server
npm run dev
```

## 📚 References

- [onlyoffice-x2t-wasm](https://github.com/cryptpad/onlyoffice-x2t-wasm) - WebAssembly-based document converter
- [se-office](https://github.com/Qihoo360/se-office) - Secure document editor
- [web-apps](https://github.com/ONLYOFFICE/web-apps) - OnlyOffice web applications
- [sdkjs](https://github.com/ONLYOFFICE/sdkjs) - OnlyOffice JavaScript SDK
- [onlyoffice-web-local](https://github.com/sweetwisdom/onlyoffice-web-local) - Local web-based OnlyOffice implementation

## 🤝 Contributing

Issues and Pull Requests are welcome to help improve this project!

## 📄 License

see the [LICENSE](LICENSE) file for details.
