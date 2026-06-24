// Package main implements the WorkBuddy PDF Control Panel server.
// Zero dependencies: stdlib only (net/http, encoding/json, mime, os, io, crypto/rand, path/filepath, strconv, strings, time, log, fmt, html/template, expvar).
package main

import (
	"bytes"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"
)

// ============================================================
// Configuration
// ============================================================

var (
	config struct {
		Port        int    `json:"port"`
		SPDFURL     string `json:"spdf_url"`
		UploadDir   string `json:"upload_dir"`
		MaxUploadMB int    `json:"max_upload_mb"`
	}
)

func initConfig() {
	config.Port = 8088
	config.SPDFURL = "http://localhost:8080"
	config.UploadDir = "/tmp/workbuddy-pdf"
	config.MaxUploadMB = 100
	if data, err := os.ReadFile("config.json"); err == nil {
		json.Unmarshal(data, &config)
	}
}

// ============================================================
// PDF Function Definitions
// ============================================================

type ParamDef struct {
	Name     string   `json:"name"`
	Type     string   `json:"type"`
	Default  string   `json:"default,omitempty"`
	Options  []string `json:"options,omitempty"`
	Required bool     `json:"required,omitempty"`
}

type PDFFunction struct {
	ID          string     `json:"id"`
	Name        string     `json:"name"`
	Category    string     `json:"category"`
	Description string     `json:"description"`
	Endpoint    string     `json:"endpoint"`
	Method      string     `json:"method"`
	InputTypes  []string   `json:"input_types"`
	OutputType  string     `json:"output_type"`
	Params      []ParamDef `json:"params,omitempty"`
}

var pdfFunctions = []PDFFunction{
	// Merge & Split
	{ID: "merge", Name: "合并PDF", Category: "合并/拆分", Description: "将多个PDF文件合并为一个", Endpoint: "/api/v1/general/merge-pdfs", Method: "POST", InputTypes: []string{"pdf"}, OutputType: "pdf"},
	{ID: "split-pages", Name: "拆分页面", Category: "合并/拆分", Description: "从PDF中提取指定页面", Endpoint: "/api/v1/general/split-pages", Method: "POST", InputTypes: []string{"pdf"}, OutputType: "pdf", Params: []ParamDef{{Name: "pages", Type: "text", Required: true, Default: "1,3,5"}}},
	{ID: "split-by-size", Name: "按大小拆分", Category: "合并/拆分", Description: "按文件大小或页数拆分PDF", Endpoint: "/api/v1/general/split-by-size-or-count", Method: "POST", InputTypes: []string{"pdf"}, OutputType: "pdf", Params: []ParamDef{{Name: "splitType", Type: "select", Options: []string{"size", "count"}}}},
	{ID: "split-sections", Name: "按章节拆分", Category: "合并/拆分", Description: "按书签/章节结构拆分PDF", Endpoint: "/api/v1/general/split-pdf-by-sections", Method: "POST", InputTypes: []string{"pdf"}, OutputType: "pdf"},
	{ID: "split-chapters", Name: "按大纲拆分", Category: "合并/拆分", Description: "按PDF大纲层级拆分", Endpoint: "/api/v1/general/split-pdf-by-chapters", Method: "POST", InputTypes: []string{"pdf"}, OutputType: "pdf"},
	// Rotate & Remove
	{ID: "rotate", Name: "旋转PDF", Category: "页面操作", Description: "旋转PDF页面角度", Endpoint: "/api/v1/general/rotate-pdf", Method: "POST", InputTypes: []string{"pdf"}, OutputType: "pdf", Params: []ParamDef{{Name: "degrees", Type: "select", Options: []string{"90", "180", "270"}}}},
	{ID: "remove-pages", Name: "删除页面", Category: "页面操作", Description: "删除PDF中的指定页面", Endpoint: "/api/v1/general/remove-pages", Method: "POST", InputTypes: []string{"pdf"}, OutputType: "pdf", Params: []ParamDef{{Name: "pages", Type: "text", Required: true, Default: "1,3"}}},
	{ID: "organize", Name: "排序页面", Category: "页面操作", Description: "重新排列PDF页面顺序", Endpoint: "/api/v1/general/rearrange-pages", Method: "POST", InputTypes: []string{"pdf"}, OutputType: "pdf", Params: []ParamDef{{Name: "pages", Type: "text", Required: true, Default: "3,1,2,4"}}},
	{ID: "scale-pages", Name: "缩放页面", Category: "页面操作", Description: "缩放PDF页面尺寸", Endpoint: "/api/v1/general/scale-pages", Method: "POST", InputTypes: []string{"pdf"}, OutputType: "pdf", Params: []ParamDef{{Name: "scale", Type: "number", Default: "0.5"}}},
	{ID: "crop", Name: "裁剪页面", Category: "页面操作", Description: "裁剪PDF页面边距", Endpoint: "/api/v1/general/crop", Method: "POST", InputTypes: []string{"pdf"}, OutputType: "pdf"},
	{ID: "single-page", Name: "单页PDF", Category: "页面操作", Description: "将PDF转为单页", Endpoint: "/api/v1/general/pdf-to-single-page", Method: "POST", InputTypes: []string{"pdf"}, OutputType: "pdf"},
	{ID: "multi-layout", Name: "多页排版", Category: "页面操作", Description: "多页合排到一页", Endpoint: "/api/v1/general/multi-page-layout", Method: "POST", InputTypes: []string{"pdf"}, OutputType: "pdf"},
	{ID: "overlay", Name: "叠加PDF", Category: "页面操作", Description: "将一个PDF叠加到另一个上", Endpoint: "/api/v1/general/overlay-pdfs", Method: "POST", InputTypes: []string{"pdf"}, OutputType: "pdf"},
	// Security
	{ID: "add-password", Name: "添加密码", Category: "安全", Description: "给PDF添加打开密码", Endpoint: "/api/v1/security/add-password", Method: "POST", InputTypes: []string{"pdf"}, OutputType: "pdf", Params: []ParamDef{{Name: "password", Type: "text", Required: true}}},
	{ID: "remove-password", Name: "移除密码", Category: "安全", Description: "移除PDF密码保护", Endpoint: "/api/v1/security/remove-password", Method: "POST", InputTypes: []string{"pdf"}, OutputType: "pdf"},
	{ID: "watermark", Name: "添加水印", Category: "安全", Description: "给PDF添加文字水印", Endpoint: "/api/v1/security/add-watermark", Method: "POST", InputTypes: []string{"pdf"}, OutputType: "pdf", Params: []ParamDef{{Name: "text", Type: "text", Required: true, Default: "草稿"}}},
	{ID: "cert-sign", Name: "证书签名", Category: "安全", Description: "用证书签名PDF", Endpoint: "/api/v1/security/cert-sign", Method: "POST", InputTypes: []string{"pdf"}, OutputType: "pdf"},
	{ID: "validate-signature", Name: "验证签名", Category: "安全", Description: "验证PDF数字签名", Endpoint: "/api/v1/security/validate-signature", Method: "POST", InputTypes: []string{"pdf"}, OutputType: "pdf"},
	{ID: "auto-redact", Name: "自动隐藏", Category: "安全", Description: "自动隐藏敏感关键词", Endpoint: "/api/v1/security/auto-redact", Method: "POST", InputTypes: []string{"pdf"}, OutputType: "pdf", Params: []ParamDef{{Name: "words", Type: "text", Required: true, Default: "机密,保密"}}},
	{ID: "sanitize", Name: "净化PDF", Category: "安全", Description: "移除JavaScript和隐藏内容", Endpoint: "/api/v1/security/sanitize-pdf", Method: "POST", InputTypes: []string{"pdf"}, OutputType: "pdf"},
	{ID: "redact", Name: "手动隐藏", Category: "安全", Description: "手动隐藏指定区域", Endpoint: "/api/v1/security/redact", Method: "POST", InputTypes: []string{"pdf"}, OutputType: "pdf"},
	{ID: "remove-cert-sign", Name: "移除签名", Category: "安全", Description: "移除PDF证书签名", Endpoint: "/api/v1/security/remove-cert-sign", Method: "POST", InputTypes: []string{"pdf"}, OutputType: "pdf"},
	{ID: "get-info", Name: "PDF信息", Category: "安全", Description: "获取PDF元数据和属性", Endpoint: "/api/v1/security/get-info-on-pdf", Method: "POST", InputTypes: []string{"pdf"}, OutputType: "json"},
	// Convert
	{ID: "img-to-pdf", Name: "图片转PDF", Category: "转换", Description: "将图片转换为PDF", Endpoint: "/api/v1/convert/img/pdf", Method: "POST", InputTypes: []string{"image"}, OutputType: "pdf"},
	{ID: "pdf-to-img", Name: "PDF转图片", Category: "转换", Description: "将PDF页面转为图片", Endpoint: "/api/v1/convert/pdf/img", Method: "POST", InputTypes: []string{"pdf"}, OutputType: "image"},
	{ID: "pdf-to-word", Name: "PDF转Word", Category: "转换", Description: "将PDF转为Word文档", Endpoint: "/api/v1/convert/pdf/word", Method: "POST", InputTypes: []string{"pdf"}, OutputType: "docx"},
	{ID: "pdf-to-text", Name: "PDF转文本", Category: "转换", Description: "从PDF提取纯文本", Endpoint: "/api/v1/convert/pdf/text", Method: "POST", InputTypes: []string{"pdf"}, OutputType: "txt"},
	{ID: "pdf-to-csv", Name: "PDF转CSV", Category: "转换", Description: "从PDF提取表格为CSV", Endpoint: "/api/v1/convert/pdf/csv", Method: "POST", InputTypes: []string{"pdf"}, OutputType: "csv"},
	{ID: "pdf-to-html", Name: "PDF转HTML", Category: "转换", Description: "将PDF转为HTML网页", Endpoint: "/api/v1/convert/pdf/html", Method: "POST", InputTypes: []string{"pdf"}, OutputType: "html"},
	{ID: "pdf-to-markdown", Name: "PDF转Markdown", Category: "转换", Description: "将PDF转为Markdown格式", Endpoint: "/api/v1/convert/pdf/markdown", Method: "POST", InputTypes: []string{"pdf"}, OutputType: "md"},
	{ID: "pdf-to-presentation", Name: "PDF转演示文稿", Category: "转换", Description: "将PDF转为PPT演示文稿", Endpoint: "/api/v1/convert/pdf/presentation", Method: "POST", InputTypes: []string{"pdf"}, OutputType: "pptx"},
	{ID: "pdf-to-xml", Name: "PDF转XML", Category: "转换", Description: "将PDF转为XML格式", Endpoint: "/api/v1/convert/pdf/xml", Method: "POST", InputTypes: []string{"pdf"}, OutputType: "xml"},
	{ID: "pdf-to-pdfa", Name: "PDF/A转换", Category: "转换", Description: "转换为长期存档PDF/A格式", Endpoint: "/api/v1/convert/pdf/pdfa", Method: "POST", InputTypes: []string{"pdf"}, OutputType: "pdf"},
	{ID: "url-to-pdf", Name: "网页转PDF", Category: "转换", Description: "将URL网页转为PDF", Endpoint: "/api/v1/convert/url/pdf", Method: "POST", InputTypes: []string{"url"}, OutputType: "pdf", Params: []ParamDef{{Name: "url", Type: "text", Required: true}}},
	{ID: "html-to-pdf", Name: "HTML转PDF", Category: "转换", Description: "将HTML文件转为PDF", Endpoint: "/api/v1/convert/html/pdf", Method: "POST", InputTypes: []string{"html"}, OutputType: "pdf"},
	{ID: "markdown-to-pdf", Name: "Markdown转PDF", Category: "转换", Description: "将Markdown文件转为PDF", Endpoint: "/api/v1/convert/markdown/pdf", Method: "POST", InputTypes: []string{"md"}, OutputType: "pdf"},
	{ID: "ebook-to-pdf", Name: "电子书转PDF", Category: "转换", Description: "将电子书文件转为PDF", Endpoint: "/api/v1/convert/ebook/pdf", Method: "POST", InputTypes: []string{"epub","mobi","azw3"}, OutputType: "pdf"},
	{ID: "file-to-pdf", Name: "文件转PDF", Category: "转换", Description: "将任意文件转为PDF", Endpoint: "/api/v1/convert/file/pdf", Method: "POST", InputTypes: []string{"any"}, OutputType: "pdf"},
	// Misc
	{ID: "compress", Name: "压缩PDF", Category: "优化", Description: "减小PDF文件大小", Endpoint: "/api/v1/misc/compress-pdf", Method: "POST", InputTypes: []string{"pdf"}, OutputType: "pdf"},
	{ID: "decompress", Name: "解压PDF", Category: "优化", Description: "解压PDF以增大文件", Endpoint: "/api/v1/misc/decompress-pdf", Method: "POST", InputTypes: []string{"pdf"}, OutputType: "pdf"},
	{ID: "ocr", Name: "OCR识别", Category: "优化", Description: "对扫描版PDF进行文字识别", Endpoint: "/api/v1/misc/ocr-pdf", Method: "POST", InputTypes: []string{"pdf"}, OutputType: "pdf", Params: []ParamDef{{Name: "languages", Type: "text", Default: "chi_sim+eng"}}},
	{ID: "repair", Name: "修复PDF", Category: "优化", Description: "修复损坏的PDF文件", Endpoint: "/api/v1/misc/repair", Method: "POST", InputTypes: []string{"pdf"}, OutputType: "pdf"},
	{ID: "flatten", Name: "扁平化PDF", Category: "优化", Description: "移除表单和注释", Endpoint: "/api/v1/misc/flatten", Method: "POST", InputTypes: []string{"pdf"}, OutputType: "pdf"},
	{ID: "remove-blanks", Name: "删除空白页", Category: "优化", Description: "自动删除空白页面", Endpoint: "/api/v1/misc/remove-blanks", Method: "POST", InputTypes: []string{"pdf"}, OutputType: "pdf"},
	{ID: "extract-images", Name: "提取图片", Category: "优化", Description: "从PDF中提取所有图片", Endpoint: "/api/v1/misc/extract-images", Method: "POST", InputTypes: []string{"pdf"}, OutputType: "image"},
	{ID: "extract-scans", Name: "提取扫描", Category: "优化", Description: "从PDF提取扫描图片", Endpoint: "/api/v1/misc/extract-image-scans", Method: "POST", InputTypes: []string{"pdf"}, OutputType: "image"},
	{ID: "add-page-numbers", Name: "添加页码", Category: "优化", Description: "给PDF添加页码", Endpoint: "/api/v1/misc/add-page-numbers", Method: "POST", InputTypes: []string{"pdf"}, OutputType: "pdf", Params: []ParamDef{{Name: "position", Type: "select", Options: []string{"bottom-center", "top-right", "bottom-right"}}}},
	{ID: "add-image", Name: "添加图片", Category: "优化", Description: "在PDF中添加图片", Endpoint: "/api/v1/misc/add-image", Method: "POST", InputTypes: []string{"pdf"}, OutputType: "pdf"},
	{ID: "add-stamp", Name: "添加印章", Category: "优化", Description: "在PDF上添加印章", Endpoint: "/api/v1/misc/add-stamp", Method: "POST", InputTypes: []string{"pdf"}, OutputType: "pdf"},
	{ID: "add-attachments", Name: "添加附件", Category: "优化", Description: "向PDF添加附件", Endpoint: "/api/v1/misc/add-attachments", Method: "POST", InputTypes: []string{"pdf"}, OutputType: "pdf"},
	{ID: "update-metadata", Name: "更新元数据", Category: "优化", Description: "修改PDF标题/作者/主题", Endpoint: "/api/v1/misc/update-metadata", Method: "POST", InputTypes: []string{"pdf"}, OutputType: "pdf", Params: []ParamDef{{Name: "title", Type: "text"}, {Name: "author", Type: "text"}}},
	{ID: "auto-rename", Name: "自动重命名", Category: "优化", Description: "根据内容自动重命名PDF", Endpoint: "/api/v1/misc/auto-rename", Method: "POST", InputTypes: []string{"pdf"}, OutputType: "pdf"},
	{ID: "auto-split", Name: "自动拆分", Category: "优化", Description: "根据内容自动拆分PDF", Endpoint: "/api/v1/misc/auto-split-pdf", Method: "POST", InputTypes: []string{"pdf"}, OutputType: "pdf"},
	{ID: "show-javascript", Name: "显示JS", Category: "优化", Description: "显示PDF中的JavaScript", Endpoint: "/api/v1/misc/show-javascript", Method: "POST", InputTypes: []string{"pdf"}, OutputType: "text"},
	{ID: "invert-color", Name: "反色PDF", Category: "优化", Description: "反转PDF颜色", Endpoint: "/api/v1/misc/replace-invert-pdf", Method: "POST", InputTypes: []string{"pdf"}, OutputType: "pdf"},
	// Filter
	{ID: "filter-size", Name: "按大小筛选", Category: "筛选", Description: "筛选大于/小于指定大小的页面", Endpoint: "/api/v1/filter/filter-file-size", Method: "POST", InputTypes: []string{"pdf"}, OutputType: "pdf", Params: []ParamDef{{Name: "minSize", Type: "number"}, {Name: "maxSize", Type: "number"}}},
	{ID: "filter-text", Name: "按文本筛选", Category: "筛选", Description: "筛选包含指定文本的页面", Endpoint: "/api/v1/filter/filter-contains-text", Method: "POST", InputTypes: []string{"pdf"}, OutputType: "pdf", Params: []ParamDef{{Name: "text", Type: "text", Required: true}}},
	{ID: "filter-image", Name: "按图片筛选", Category: "筛选", Description: "筛选包含图片的页面", Endpoint: "/api/v1/filter/filter-contains-image", Method: "POST", InputTypes: []string{"pdf"}, OutputType: "pdf"},
	{ID: "filter-page-size", Name: "按页面大小筛选", Category: "筛选", Description: "筛选特定尺寸的页面", Endpoint: "/api/v1/filter/filter-page-size", Method: "POST", InputTypes: []string{"pdf"}, OutputType: "pdf"},
	{ID: "filter-page-count", Name: "按页数筛选", Category: "筛选", Description: "筛选页数满足条件的页面", Endpoint: "/api/v1/filter/filter-page-count", Method: "POST", InputTypes: []string{"pdf"}, OutputType: "pdf"},
	{ID: "filter-page-rotation", Name: "按旋转筛选", Category: "筛选", Description: "筛选特定旋转角度的页面", Endpoint: "/api/v1/filter/filter-page-rotation", Method: "POST", InputTypes: []string{"pdf"}, OutputType: "pdf"},
	// Remove
	{ID: "remove-image", Name: "移除图片", Category: "页面操作", Description: "从PDF中移除所有图片", Endpoint: "/api/v1/general/remove-image-pdf", Method: "POST", InputTypes: []string{"pdf"}, OutputType: "pdf"},
}

// ============================================================
// File Upload Handling
// ============================================================

var uploadMutex sync.Mutex

func generateUploadID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return fmt.Sprintf("%x", b)
}

func ensureUploadDir() {
	os.MkdirAll(config.UploadDir, 0755)
	// Clean old uploads (> 1 hour)
	go func() {
		for range time.Tick(5 * time.Minute) {
			uploadMutex.Lock()
			filepath.Walk(config.UploadDir, func(path string, info os.FileInfo, err error) error {
				if err != nil || info.IsDir() {
					return nil
				}
				if time.Since(info.ModTime()) > time.Hour {
					os.Remove(path)
				}
				return nil
			})
			uploadMutex.Unlock()
		}
	}()
}

func handleUpload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	uploadMutex.Lock()
	defer uploadMutex.Unlock()

	reader, err := r.MultipartReader()
	if err != nil {
		http.Error(w, "Failed to parse multipart", http.StatusBadRequest)
		return
	}

	uploadID := generateUploadID()
	uploadPath := filepath.Join(config.UploadDir, uploadID)
	os.MkdirAll(uploadPath, 0755)

	var files []string
	for {
		part, err := reader.NextPart()
		if err == io.EOF {
			break
		}
		if err != nil {
			http.Error(w, "Error reading part", http.StatusBadRequest)
			return
		}
		defer part.Close()

		if part.FormName() == "file" {
			filename := filepath.Base(part.FileName())
			dstPath := filepath.Join(uploadPath, filename)
			dst, err := os.Create(dstPath)
			if err != nil {
				http.Error(w, "Failed to save file", http.StatusInternalServerError)
				return
			}
			io.Copy(dst, part)
			dst.Close()
			files = append(files, dstPath)
		}
	}

	if len(files) == 0 {
		http.Error(w, "No files uploaded", http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"uploadId": uploadID,
		"files":    files,
		"count":    len(files),
	})
}

func handleDownload(w http.ResponseWriter, r *http.Request) {
	uploadID := r.URL.Query().Get("id")
	filename := r.URL.Query().Get("file")
	if uploadID == "" || filename == "" {
		http.Error(w, "Missing id or file", http.StatusBadRequest)
		return
	}

	path := filepath.Join(config.UploadDir, uploadID, filename)
	if _, err := os.Stat(path); os.IsNotExist(err) {
		http.Error(w, "File not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))
	http.ServeFile(w, r, path)
}

// ============================================================
// Proxy Handler - Forward requests to Stirling-PDF
// ============================================================

func proxyHandler(w http.ResponseWriter, r *http.Request) {
	target := config.SPDFURL + r.URL.Path
	if r.URL.RawQuery != "" {
		target += "?" + r.URL.RawQuery
	}

	// Build request
	req, err := http.NewRequest(r.Method, target, r.Body)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Copy headers
	req.Header.Set("User-Agent", "WorkBuddy-PDF/1.0")
	for k, vals := range r.Header {
		for _, v := range vals {
			if k != "Host" && k != "Content-Length" {
				req.Header.Add(k, v)
			}
		}
	}

	// Handle file uploads for proxy
	if r.Header.Get("Content-Type") == "multipart/form-data" {
		// Parse multipart to find files, upload to temp dir
		// For multipart, just read the original body and forward it
		var bodyBuf bytes.Buffer
		bodyBuf.ReadFrom(r.Body)
		req.Body = io.NopCloser(&bodyBuf)
		req.ContentLength = int64(bodyBuf.Len())
		req.Header.Set("Content-Type", r.Header.Get("Content-Type"))
	}

	// Execute request
	client := &http.Client{Timeout: 300 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		http.Error(w, "Backend unavailable: "+err.Error(), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	// Copy response
	w.Header().Set("Content-Type", resp.Header.Get("Content-Type"))
	if strings.Contains(resp.Header.Get("Content-Type"), "application/pdf") {
		w.Header().Set("Content-Disposition", "attachment; filename=result.pdf")
	}
	io.Copy(w, resp.Body)
	w.WriteHeader(resp.StatusCode)
}

func createMultipartBody(uploadDir string, reader *multipart.Reader) *strings.Builder {
	// Simplified: just forward the body as-is
	// In production, would properly remap file paths
	var buf strings.Builder
	buf.WriteString("--boundary\r\n")
	buf.WriteString(fmt.Sprintf("Content-Disposition: form-data; name=\"file\"; filename=\"uploaded.pdf\"\r\n"))
	buf.WriteString("Content-Type: application/pdf\r\n\r\n")
	return &buf
}

// ============================================================
// API Handlers
// ============================================================

func handleAPIFunctions(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	switch r.URL.Path {
	case "/api/functions":
		json.NewEncoder(w).Encode(pdfFunctions)
	case "/api/functions/categories":
		categories := make(map[string][]string)
		for _, fn := range pdfFunctions {
			categories[fn.Category] = append(categories[fn.Category], fn.ID)
		}
		json.NewEncoder(w).Encode(categories)
	case "/api/status":
		// Check if Stirling-PDF is reachable
		client := &http.Client{Timeout: 5 * time.Second}
		resp, err := client.Get(config.SPDFURL + "/api/v1/info/general")
		status := "offline"
		if err == nil {
			resp.Body.Close()
			status = "online"
		}
		json.NewEncoder(w).Encode(map[string]string{
			"status":      status,
			"url":         config.SPDFURL,
			"functions":   strconv.Itoa(len(pdfFunctions)),
			"upload_dir":  config.UploadDir,
			"max_upload":  strconv.Itoa(config.MaxUploadMB) + "MB",
		})
	case "/api/config":
		json.NewEncoder(w).Encode(map[string]interface{}{
			"port":        config.Port,
			"spdf_url":    config.SPDFURL,
			"max_upload":  config.MaxUploadMB,
		})
	default:
		http.NotFound(w, r)
	}
}

// ============================================================
// Static File Serving
// ============================================================

var (
	staticFS http.FileSystem
	staticDir string
)

func initStaticFS() {
	staticDir = "static"
	if _, err := os.Stat(staticDir); os.IsNotExist(err) {
		os.MkdirAll(staticDir, 0755)
	}
	staticFS = http.Dir(staticDir)
}

// ============================================================
// Router
// ============================================================

func router(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path

	// API routes
	if strings.HasPrefix(path, "/api/") {
		handleAPIFunctions(w, r)
		return
	}

	// Upload routes
	if path == "/upload" {
		handleUpload(w, r)
		return
	}
	if path == "/download" {
		handleDownload(w, r)
		return
	}

	// Proxy all other non-static requests to Stirling-PDF
	if r.Method == http.MethodPost || strings.HasPrefix(path, "/api/") {
		proxyHandler(w, r)
		return
	}

	// Serve static files
	if path == "/" || path == "" {
		http.ServeFile(w, r, "static/index.html")
		return
	}

	// Try to serve static file
	filePath := filepath.Join(staticDir, path)
	if _, err := os.Stat(filePath); err == nil {
		http.ServeFile(w, r, filePath)
		return
	}

	// SPA fallback - serve index.html
	http.ServeFile(w, r, "static/index.html")
}

// ============================================================
// Main
// ============================================================

func main() {
	initConfig()
	ensureUploadDir()
	initStaticFS()

	log.Printf("📦 WorkBuddy PDF Control Panel")
	log.Printf("   Port:        :%d", config.Port)
	log.Printf("   Backend URL: %s", config.SPDFURL)
	log.Printf("   Upload Dir:  %s", config.UploadDir)
	log.Printf("   Functions:   %d PDF operations available", len(pdfFunctions))

	http.HandleFunc("/", router)

	addr := fmt.Sprintf(":%d", config.Port)
	log.Printf("🚀 Server listening on http://localhost%s", addr)
	if err := http.ListenAndServe(addr, nil); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
