import React, { useState, useEffect } from 'react';
import * as mammoth from 'mammoth';

interface FilePreviewerProps {
    fileUrl: string;
    fileName: string;
    fileType: string;
    onClose: () => void;
}

interface PreviewData {
    type: 'pdf' | 'image' | 'text' | 'code' | 'html' | 'docx' | 'excel' | 'powerpoint' | 'json' | 'xml' | 'csv' | 'unsupported';
    content: any;
    language?: string;
}

const FilePreviewer: React.FC<FilePreviewerProps> = ({
    fileUrl,
    fileName,
    fileType,
    onClose
}) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [previewData, setPreviewData] = useState<PreviewData | null>(null);
    const [zoom, setZoom] = useState(1);
    const [viewMode, setViewMode] = useState<'preview' | 'raw'>('preview');

    // Xác định loại file và ngôn ngữ cho syntax highlighting
    const detectFileType = (filename: string, mimeType: string): { type: PreviewData['type'], language: string } => {
        const name = filename.toLowerCase();
        const type = mimeType.toLowerCase();

        console.log('🔍 Detecting file type:', { name, type });

        // 1. Office files - kiểm tra TRƯỚC để tránh nhầm với xml
        if (type.includes('openxmlformats-officedocument.wordprocessingml.document') ||
            name.endsWith('.docx') || type.includes('word') || type.includes('msword')) {
            console.log('📝 Detected as Word document');
            return { type: 'docx', language: 'html' };
        }

        if (type.includes('pdf')) {
            console.log('📄 Detected as PDF');
            return { type: 'pdf', language: 'plaintext' };
        }

        if (type.startsWith('image/')) {
            console.log('🖼️ Detected as image');
            return { type: 'image', language: 'plaintext' };
        }

        // 2. Code files - kiểm tra bằng filename vì MIME type có thể không đúng
        if (name.endsWith('.js') || name.endsWith('.jsx')) {
            console.log('💻 Detected as JavaScript');
            return { type: 'code', language: 'javascript' };
        }
        if (name.endsWith('.ts') || name.endsWith('.tsx')) {
            console.log('💻 Detected as TypeScript');
            return { type: 'code', language: 'typescript' };
        }
        if (name.endsWith('.py')) {
            console.log('💻 Detected as Python');
            return { type: 'code', language: 'python' };
        }
        if (name.endsWith('.java')) {
            console.log('💻 Detected as Java');
            return { type: 'code', language: 'java' };
        }
        if (name.endsWith('.cpp') || name.endsWith('.c') || name.endsWith('.h') || name.endsWith('.hpp')) {
            console.log('💻 Detected as C/C++');
            return { type: 'code', language: 'cpp' };
        }
        if (name.endsWith('.php')) {
            console.log('💻 Detected as PHP');
            return { type: 'code', language: 'php' };
        }
        if (name.endsWith('.rb')) {
            console.log('💻 Detected as Ruby');
            return { type: 'code', language: 'ruby' };
        }
        if (name.endsWith('.go')) {
            console.log('💻 Detected as Go');
            return { type: 'code', language: 'go' };
        }
        if (name.endsWith('.rs')) {
            console.log('💻 Detected as Rust');
            return { type: 'code', language: 'rust' };
        }
        if (name.endsWith('.swift')) {
            console.log('💻 Detected as Swift');
            return { type: 'code', language: 'swift' };
        }
        if (name.endsWith('.kt') || name.endsWith('.kts')) {
            console.log('💻 Detected as Kotlin');
            return { type: 'code', language: 'kotlin' };
        }

        // 3. Data files
        if (name.endsWith('.json') || type.includes('json')) {
            console.log('📋 Detected as JSON');
            return { type: 'json', language: 'json' };
        }
        if (name.endsWith('.xml') || type.includes('xml')) {
            console.log('📑 Detected as XML');
            return { type: 'xml', language: 'xml' };
        }
        if (name.endsWith('.csv') || type.includes('csv')) {
            console.log('📈 Detected as CSV');
            return { type: 'csv', language: 'plaintext' };
        }

        // 4. Text files
        if (type.startsWith('text/') || name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.markdown')) {
            console.log('📃 Detected as text');
            return { type: 'text', language: 'plaintext' };
        }

        // 5. Web files
        if (name.endsWith('.html') || name.endsWith('.htm') || type.includes('html')) {
            console.log('🌐 Detected as HTML');
            return { type: 'html', language: 'html' };
        }
        if (name.endsWith('.css')) {
            console.log('🎨 Detected as CSS');
            return { type: 'code', language: 'css' };
        }

        // 6. Excel & PowerPoint
        if (name.endsWith('.xlsx') || name.endsWith('.xls') || type.includes('excel') || type.includes('spreadsheet')) {
            console.log('📊 Detected as Excel');
            return { type: 'excel', language: 'plaintext' };
        }
        if (name.endsWith('.pptx') || name.endsWith('.ppt') || type.includes('powerpoint') || type.includes('presentation')) {
            console.log('📽️ Detected as PowerPoint');
            return { type: 'powerpoint', language: 'plaintext' };
        }

        // 7. Fallback: MIME type không xác định - dựa vào filename
        console.log('❓ Unknown MIME type, checking extension...');

        const extension = name.split('.').pop();
        switch (extension) {
            case 'js': case 'jsx': return { type: 'code', language: 'javascript' };
            case 'ts': case 'tsx': return { type: 'code', language: 'typescript' };
            case 'py': return { type: 'code', language: 'python' };
            case 'java': return { type: 'code', language: 'java' };
            case 'cpp': case 'c': case 'h': return { type: 'code', language: 'cpp' };
            case 'php': return { type: 'code', language: 'php' };
            case 'rb': return { type: 'code', language: 'ruby' };
            case 'go': return { type: 'code', language: 'go' };
            case 'rs': return { type: 'code', language: 'rust' };
            case 'swift': return { type: 'code', language: 'swift' };
            case 'kt': case 'kts': return { type: 'code', language: 'kotlin' };
            case 'json': return { type: 'json', language: 'json' };
            case 'xml': return { type: 'xml', language: 'xml' };
            case 'csv': return { type: 'csv', language: 'plaintext' };
            case 'txt': case 'md': return { type: 'text', language: 'plaintext' };
            case 'html': case 'htm': return { type: 'html', language: 'html' };
            case 'css': return { type: 'code', language: 'css' };
            case 'docx': return { type: 'docx', language: 'html' };
            case 'pdf': return { type: 'pdf', language: 'plaintext' };
            default:
                console.log('⚠️ Could not detect file type, defaulting to text');
                return { type: 'text', language: 'plaintext' };
        }
    };

    // Load file
    useEffect(() => {
        const loadFile = async () => {
            try {
                setLoading(true);
                setError(null);

                console.log('🔍 Loading file:', { fileUrl, fileName, fileType });

                const response = await fetch(fileUrl, {
                    credentials: 'include'
                });

                console.log('📄 Response status:', response.status);
                console.log('📄 Response headers:', Object.fromEntries(response.headers.entries()));

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const blob = await response.blob();
                console.log('📦 Blob received:', {
                    size: blob.size,
                    type: blob.type
                });

                if (blob.size === 0) {
                    throw new Error('File is empty');
                }

                const detected = detectFileType(fileName, fileType);
                console.log('Detected file:', detected);

                switch (detected.type) {
                    case 'pdf':
                        // Tạo URL cho PDF
                        const pdfUrl = URL.createObjectURL(blob);
                        setPreviewData({
                            type: 'pdf',
                            content: pdfUrl
                        });
                        break;

                    case 'image':
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            setPreviewData({
                                type: 'image',
                                content: e.target?.result
                            });
                        };
                        reader.readAsDataURL(blob);
                        break;

                    case 'code':
                        console.log('📝 Processing code file...');
                        try {
                            const text = await blob.text();
                            console.log('✅ Successfully read code file, length:', text.length);
                            console.log('📊 First 500 chars:', text.substring(0, 500));

                            setPreviewData({
                                type: 'code',
                                content: text,
                                language: detected.language
                            });
                        } catch (codeError: any) {
                            console.error('❌ Failed to read code file:', codeError);
                            setPreviewData({
                                type: 'text',
                                content: `Error reading ${fileName}: ${codeError.message}`,
                                language: 'plaintext'
                            });
                        }
                        setLoading(false);
                        break;

                    case 'text':
                    case 'json':
                    case 'xml':
                    case 'csv':
                        const text = await blob.text();
                        setPreviewData({
                            type: detected.type,
                            content: text,
                            language: detected.language
                        });
                        break;

                    case 'html':
                        const html = await blob.text();
                        setPreviewData({
                            type: 'html',
                            content: html,
                            language: 'html'
                        });
                        break;

                    case 'docx':
                        try {
                            const result = await mammoth.convertToHtml({
                                arrayBuffer: await blob.arrayBuffer()
                            });
                            setPreviewData({
                                type: 'html',
                                content: result.value,
                                language: 'html'
                            });
                        } catch (docxError) {
                            console.warn('DOCX conversion failed, showing as text');
                            const text = await blob.text();
                            setPreviewData({
                                type: 'text',
                                content: `Word Document\n\n${text.substring(0, 5000)}...`,
                                language: 'plaintext'
                            });
                        }
                        break;

                    case 'excel':
                        // Thử đọc Excel dưới dạng text
                        try {
                            const text = await blob.text();
                            const lines = text.split('\n').slice(0, 50); // Lấy 50 dòng đầu
                            setPreviewData({
                                type: 'text',
                                content: `Excel Spreadsheet Preview\n\n${lines.join('\n')}\n\n... [For full content, please download]`,
                                language: 'plaintext'
                            });
                        } catch {
                            setPreviewData({
                                type: 'text',
                                content: `Excel file detected\nSize: ${formatFileSize(blob.size)}\n\nPlease download to view.`,
                                language: 'plaintext'
                            });
                        }
                        break;

                    case 'powerpoint':
                        setPreviewData({
                            type: 'text',
                            content: `PowerPoint Presentation\nSize: ${formatFileSize(blob.size)}\n\nPlease download to view slides.`,
                            language: 'plaintext'
                        });
                        break;


                    default:
                        setPreviewData({
                            type: 'unsupported',
                            content: `Cannot preview ${fileName}\nType: ${fileType}\nSize: ${formatFileSize(blob.size)}\n\nPlease download to view.`,
                            language: 'plaintext'
                        });
                        break;
                }

                setLoading(false);
            } catch (err: any) {
                console.error('Load error:', err);
                setError(`Cannot load file: ${err.message}`);
                setLoading(false);
            }
        };

        loadFile();
    }, [fileUrl, fileName, fileType]);

    // Format file size
    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const handleDownload = () => {
        window.open(fileUrl, '_blank');
    };

    const handleZoomIn = () => setZoom(z => Math.min(z + 0.1, 2));
    const handleZoomOut = () => setZoom(z => Math.max(z - 0.1, 0.5));
    // const handleZoomReset = () => setZoom(1);

    const getFileIcon = () => {
        switch (previewData?.type) {
            case 'pdf': return '📄';
            case 'image': return '🖼️';
            case 'code': return '💻';
            case 'text': return '📃';
            case 'html': return '🌐';
            case 'json': return '📋';
            case 'xml': return '📑';
            case 'csv': return '📈';
            case 'docx': return '📝';
            case 'excel': return '📊';
            case 'powerpoint': return '📽️';
            default: return '📎';
        }
    };

    const getFileTypeName = () => {
        switch (previewData?.type) {
            case 'pdf': return 'PDF Document';
            case 'image': return 'Image';
            case 'code': return 'Source Code';
            case 'text': return 'Text File';
            case 'html': return 'HTML Document';
            case 'json': return 'JSON File';
            case 'xml': return 'XML File';
            case 'csv': return 'CSV File';
            case 'docx': return 'Word Document';
            case 'excel': return 'Excel Spreadsheet';
            case 'powerpoint': return 'PowerPoint';
            default: return 'File';
        }
    };

    // Simple syntax highlighting
    // const highlightSyntax = (code: string, language: string) => {
    //     // Basic syntax highlighting for common languages
    //     if (language === 'json' || language === 'javascript' || language === 'typescript') {
    //         try {
    //             const json = JSON.stringify(JSON.parse(code), null, 2);
    //             return <pre className={`code-content language-${language}`}>{json}</pre>;
    //         } catch {
    //             // Not valid JSON, return as-is
    //         }
    //     }

    //     return <pre className={`code-content language-${language}`}>{code}</pre>;
    // };

    if (loading) {
        return (
            <div className="file-previewer">
                <div className="preview-header">
                    <div className="file-info">
                        <div className="file-icon">{getFileIcon()}</div>
                        <div className="file-details">
                            <h4>Loading {fileName}...</h4>
                        </div>
                    </div>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>
                <div className="preview-content loading">
                    <div className="loading-content">
                        <div className="spinner"></div>
                        <p>Loading file...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="file-previewer">
                <div className="preview-header">
                    <div className="file-info">
                        <div className="file-icon">❌</div>
                        <div className="file-details">
                            <h4>Error</h4>
                        </div>
                    </div>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>
                <div className="preview-content error">
                    <div className="error-content">
                        <div className="error-icon">⚠️</div>
                        <h3>Failed to Load</h3>
                        <p>{error}</p>
                        <button className="btn btn-outline" onClick={handleDownload}>
                            ⬇️ Download
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="file-previewer">
            <div className="preview-header">
                <div className="file-info">
                    <div className="file-icon">{getFileIcon()}</div>
                    <div className="file-details">
                        <h4 title={fileName}>
                            {fileName.length > 40 ? `${fileName.substring(0, 40)}...` : fileName}
                        </h4>
                        <div className="file-meta">
                            <span className="file-type">{getFileTypeName()}</span>
                            {previewData?.language && previewData.language !== 'plaintext' && (
                                <span className="language-badge">{previewData.language}</span>
                            )}
                        </div>
                    </div>
                </div>
                <button className="close-btn" onClick={onClose}>×</button>
            </div>

            {/* Controls */}
            <div className="preview-controls">
                {(previewData?.type === 'pdf' || previewData?.type === 'image') && (
                    <div className="zoom-controls">
                        <button className="zoom-btn" onClick={handleZoomOut}>🔍-</button>
                        <span className="zoom-level">{Math.round(zoom * 100)}%</span>
                        <button className="zoom-btn" onClick={handleZoomIn}>🔍+</button>
                    </div>
                )}

                {(previewData?.type === 'code' || previewData?.type === 'text' || previewData?.type === 'json' || previewData?.type === 'xml') && (
                    <div className="view-toggle">
                        <button
                            className={`view-btn ${viewMode === 'preview' ? 'active' : ''}`}
                            onClick={() => setViewMode('preview')}
                        >
                            Preview
                        </button>
                        <button
                            className={`view-btn ${viewMode === 'raw' ? 'active' : ''}`}
                            onClick={() => setViewMode('raw')}
                        >
                            Raw Text
                        </button>
                    </div>
                )}

                <button className="btn btn-outline" onClick={handleDownload}>
                    ⬇️ Download
                </button>
            </div>

            {/* Preview Content */}
            <div className="preview-content">
                {previewData?.type === 'pdf' && (
                    <div className="pdf-container">
                        <iframe
                            src={previewData.content}
                            title={fileName}
                            className="pdf-viewer"
                            style={{ transform: `scale(${zoom})` }}
                        />
                    </div>
                )}

                {previewData?.type === 'image' && (
                    <div className="image-container">
                        <img
                            src={previewData.content}
                            alt={fileName}
                            className="preview-image"
                            style={{ transform: `scale(${zoom})` }}
                        />
                    </div>
                )}

                {(previewData?.type === 'code' || previewData?.type === 'text' ||
                    previewData?.type === 'json' || previewData?.type === 'xml' ||
                    previewData?.type === 'csv') && (
                        <div className="text-viewer">
                            <div className="text-header">
                                <span className="file-info-badge">
                                    {previewData.language} • {previewData.content.split('\n').length} lines
                                </span>
                            </div>
                            <div className="content-container">
                                {viewMode === 'preview' ? (
                                    <pre className="code-content">{previewData.content}</pre>
                                ) : (
                                    <pre className="raw-content">{previewData.content}</pre>
                                )}
                            </div>
                        </div>
                    )}

                {previewData?.type === 'html' && (
                    <div className="html-viewer">
                        {viewMode === 'preview' ? (
                            <iframe
                                srcDoc={previewData.content}
                                title={fileName}
                                className="html-iframe"
                                sandbox="allow-same-origin"
                            />
                        ) : (
                            <div className="html-raw-container">
                                <pre className="html-content">{previewData.content}</pre>
                            </div>
                        )}
                    </div>
                )}

                {previewData?.type === 'docx' && (
                    <div className="docx-viewer">
                        <div
                            className="docx-content"
                            dangerouslySetInnerHTML={{ __html: previewData.content }}
                        />
                    </div>
                )}

                {previewData?.type === 'excel' && (
                    <div className="excel-viewer">
                        <pre className="excel-content">{previewData.content}</pre>
                    </div>
                )}

                {previewData?.type === 'powerpoint' && (
                    <div className="powerpoint-viewer">
                        <div className="powerpoint-icon">📽️</div>
                        <p>{previewData.content}</p>
                    </div>
                )}

                {previewData?.type === 'unsupported' && (
                    <div className="unsupported-viewer">
                        <div className="unsupported-icon">📄</div>
                        <p>{previewData.content}</p>
                        <button className="btn btn-outline" onClick={handleDownload}>
                            ⬇️ Download File
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default FilePreviewer;