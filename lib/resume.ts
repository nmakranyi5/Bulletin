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

// The file's path inside the "resumes" bucket (e.g. "<user id>/resume.pdf"), taken from the
// public-style URL saved on the profile, or null if it isn't one of ours.
export function resumeStoragePath(url: string): string | null {
  const match = /\/object\/(?:public|sign|authenticated)\/resumes\/([^?#]+)/.exec(url);
  return match ? decodeURIComponent(match[1]) : null;
}
