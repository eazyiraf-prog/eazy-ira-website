# Content editor guide

## Before you begin

1. **[MANUAL] Create a GitHub account** using your email address.
2. **[MANUAL] Accept the repository invitation** sent to your GitHub account.
   You will need Write access to edit content in the CMS.

3. Use a GitHub account used only for Foundation work. On a shared computer,
   sign out of GitHub when you finish. If you leave the Foundation, the
   repository owner will remove your collaborator access and revoke the
   Foundation OAuth authorization from your GitHub account.

## Sign in

1. Open `https://<your-site-domain>/admin/`.
2. Choose **Login with GitHub** and sign in to the GitHub account that accepted
   the invitation.
3. Approve the requested access if GitHub asks. The CMS needs repository
   content and pull-request access so it can prepare review changes.

## Make a change

1. **Post news:** open **News posts**, choose **New**, and fill in the title,
   date, category, summary, main image and its alt text, author, and story.
   Leave **Keep this post as a draft** on until the post is ready.
2. **Add an expense report:** open **Expense reports**, choose **New**, and
   fill in each expense. Amounts are in RWF. Upload a receipt image for every
   item. The site shows **Reconciled** only when all item costs add up to the
   amount received; otherwise it shows a warning.
3. **Update impact numbers:** open **Impact figures** and enter confirmed
   figures only. Keep the confirmation switches accurate and update the
   last-updated date when the figures are checked.
4. **Upload photos:** use JPG, JPEG, PNG or WebP images under 6 MB and under
   2400 pixels wide. Home page hero images should be 1920 by 1080 pixels. MP4
   videos must be under 6 MB. Add a useful alt-text description for every
   image. Only tick child-photo consent when a guardian agreed to publication;
   record the consent without naming the child.
5. **Save a draft:** save your work in the CMS. Sveltia creates a pull request
   in its Draft stage; this does not put the change on the live site.
6. **Ask for review:** move the entry to **In Review** (or Ready to Publish
   when requested) in the Editorial Workflow and share the pull request with
   the reviewer. Wait for approval before it is merged and published.

## Please do not

- Never publish a child's full name or home address.
- Never tick photo consent unless a guardian has agreed to the photo being
  published.
- Never edit donation methods, the MTN Mobile Money code, contact email, site
  settings, translations, or code. Those are changed only by a developer.

If GitHub asks you to sign in again, use the same account that was invited to
the repository. Ask the administrator for help if you cannot see a collection
or save a draft.
