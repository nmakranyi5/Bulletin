// How a resume PDF is shown in the app.
//
// iOS's WebView renders PDFs itself. Android's does not, so there it goes through Google's
// document viewer, which turns the PDF into a page the WebView can show.

export function resumeViewerUrl(url: string, platform: string): string {
  if (platform === 'android') {
    return `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(url)}`;
  }
  return url;
}
