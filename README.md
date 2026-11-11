# Garbage Collector 2.0

A redesigned Windows Electron application for garbage/waste complaint management.

## Design
- Soft eco-white background instead of a plain white/blue screen.
- Large, faint recycling/garbage watermark in the background.
- Green + blue accent system.
- Modern Poppins/Inter typography.
- Clicked Customer / Manager / Create Account cards and buttons show a blue active state.
- Responsive dashboard layout.

## Features
### Customer
- Create account
- Customer login
- Submit garbage request
- Location + description
- Photo file selection
- Optional service amount
- Track request status
- Payment page with UPI / Card / Net Banking UI
- Payment status

### Manager
- Manager login
- View all customer requests
- See customer contact details, problem, location and the photos the customer uploaded
- Click a photo to view it full size
- New request shows only one button: **Visit**
- After Visit, an **Upload your work photo** section appears
- The **Complete** button appears only after at least one work photo is uploaded (enforced by the server too)
- See payment information

### Request flow
New -> (manager clicks Visit) -> Visit Planned -> (manager uploads work photo) -> Complete button appears -> Completed.
The customer can see both their own photos and the manager's work photos under My Requests.

## Default manager
Email: manager@garbagecollector.local
Password: Manager@123

## Payment
The included payment screen is a working local/demo payment record flow. It marks a payment as Paid and creates a transaction ID in the local database.
For real money collection, connect a live gateway such as Razorpay or Cashfree and perform server-side payment verification. Never put gateway secret keys in index.html.

## Build on Windows
1. Install Node.js 22 LTS.
2. Open this folder in Command Prompt.
3. Run `npm install`
4. Run `npm start` to test.
5. Run `npm run dist:win` to create the Windows installer and portable EXE.

Or double-click BUILD_WINDOWS.bat.

## Data
The app stores its JSON database (`data/db.json`) and uploaded photos (`photos/`) under Electron's userData directory. Photos are resized to max 1280px in the app before upload (up to 6 per upload, JPG/PNG/WEBP). The server listens on port 8787 and is bound to 0.0.0.0 for LAN use.
