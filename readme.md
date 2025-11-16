# OnlyOffice Web

🌐 **Live Demo**: https://ranuts.github.io/document/

[English](readme.md) | [中文](readme.zh.md)

A local web-based document editor based on OnlyOffice, allowing you to edit documents directly in your browser without server-side processing, ensuring your privacy and security.

## ✨ Key Features

- 🔒 **Privacy-First**: All document processing happens locally in your browser, with no uploads to any server
- 📝 **Multi-Format Support**: Supports DOCX, XLSX, PPTX, CSV, and many other document formats
- ⚡ **Real-Time Editing**: Provides smooth real-time document editing experience
- 🚀 **No Server Required**: Pure frontend implementation with no server-side processing needed
- 🎯 **Ready to Use**: Start editing documents immediately by opening the webpage
- 🌐 **Open from URL**: Load documents directly from remote URLs via URL parameters
- 🌍 **Multi-Language**: Supports multiple languages (English, Chinese) with easy switching

## 📖 Usage

### Basic Usage

1. Visit the [Online Editor](https://ranuts.github.io/document/)
2. Upload your document files or open from URL
3. Edit directly in your browser
4. Download the edited documents

### URL Parameters

| Parameter | Description | Values/Type | Priority |
|-----------|-------------|-------------|----------|
| `locale` | Set interface language | `en`, `zh` | - |
| `src` | Open document from URL (recommended) | URL string | Low |
| `file` | Open document from URL (backward compatible) | URL string | High |

**Examples:**

```bash
# Set language
?locale=zh

# Open document from URL
?src=https://example.com/document.docx

# Combine parameters
?locale=zh&src=https://example.com/doc.docx
```

**Note**: When both `file` and `src` are provided, `file` takes priority. Remote URLs must support CORS.

### As a Component Library

This project provides foundational services for document preview components in the [@ranui/preview](https://www.npmjs.com/package/@ranui/preview) WebComponent library.

📚 **Preview Component Documentation**: [https://chaxus.github.io/ran/src/ranui/preview/](https://chaxus.github.io/ran/src/ranui/preview/)

## 🛠️ Technical Architecture

- **OnlyOffice SDK**: Provides powerful document editing capabilities
- **WebAssembly**: Implements document format conversion through x2t-wasm
- **Pure Frontend Architecture**: All functionality runs in the browser

## 🚀 Deployment

### Docker

```bash
# docker run
docker run -d --name document -p 8080:8080 ghcr.io/ranui/document:latest

# docker compose
services:
  document:
    image: ghcr.io/ranui/document:latest
    container_name: document
    ports:
      - 8080:8080
```

### Important Notes

- **CORS**: Remote servers must support CORS when using `src` or `file` parameters
- **File Size**: Large files may take longer to load
- **Supported Formats**: DOCX, XLSX, PPTX, CSV, DOC, XLS, PPT, ODT, ODS, ODP, RTF, TXT, and more

## 🔧 Local Development

```bash
git clone https://github.com/ranuts/document.git
cd document
npm install
npm run dev
```

## 🔤 Font Management

### Font Files in This Project

This project is designed as an open-source solution, and therefore does not include proprietary font files such as **Arial**, **Times New Roman**, **Microsoft YaHei**, **SimSun**, and other Windows system fonts that are subject to copyright restrictions. These font references remain in the configuration files for compatibility with existing documents, but the actual font files have been removed to ensure compliance with open-source licensing requirements.

### Adding Fonts

To add fonts that are already configured in the project (such as Arial, Times New Roman, etc.), simply place the font files in the `public/fonts/` directory and rename them to match their corresponding index in the `__fonts_files` array in `public/sdkjs/common/AllFonts.js`.

**Example: Adding Arial Font**

If you want to add the Arial font to the project:

1. Check `AllFonts.js` and find that Arial regular font uses index `223` in the `__fonts_files` array
2. Place your Arial font file in `public/fonts/` and rename it to `223` (no extension needed)
3. The font file should be located at `public/fonts/223`
4. When the application references index `223`, it will automatically load the font file from `public/fonts/223`

Similarly, for other Arial variants:
- Arial Bold uses index `226` → place font file as `public/fonts/226`
- Arial Italic uses index `224` → place font file as `public/fonts/224`
- Arial Bold Italic uses index `225` → place font file as `public/fonts/225`

You can find the index for any font by checking the `__fonts_infos` array in `AllFonts.js`, where each font entry specifies the indices for its regular, bold, italic, and bold-italic variants.

**Note**: Only use open-source fonts or fonts for which you have proper licensing rights. Ensure compliance with font licensing terms before adding any font files.

## 📚 References

- [onlyoffice-x2t-wasm](https://github.com/cryptpad/onlyoffice-x2t-wasm) - WebAssembly-based document converter
- [se-office](https://github.com/Qihoo360/se-office) - Secure document editor
- [web-apps](https://github.com/ONLYOFFICE/web-apps) - OnlyOffice web applications
- [sdkjs](https://github.com/ONLYOFFICE/sdkjs) - OnlyOffice JavaScript SDK

## 🤝 Contributing

Issues and Pull Requests are welcome to help improve this project!

## 📄 License

See the [LICENSE](LICENSE) file for details.
