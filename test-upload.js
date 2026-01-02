
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = "http://localhost:5000/api";
const PHONE_NUMBER = "9999999999";

async function runTest() {
    try {
        console.log("1. Logging in...");
        const loginRes = await fetch(`${BASE_URL}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phoneNumber: PHONE_NUMBER })
        });
        const loginData = await loginRes.json();

        if (!loginData.status) throw new Error("Login failed: " + JSON.stringify(loginData));

        const otp = loginData.data.otp;
        console.log("OTP:", otp);

        const verifyRes = await fetch(`${BASE_URL}/auth/otp/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phoneNumber: PHONE_NUMBER, otp })
        });
        const verifyData = await verifyRes.json();
        const token = verifyData.data.token;
        console.log("Token received");

        console.log("2. Creating Ticket...");
        const ticketRes = await fetch(`${BASE_URL}/tickets`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ subject: "Upload Test", issueType: "Bug" })
        });
        const ticket = await ticketRes.json();
        console.log("Ticket ID:", ticket._id);

        console.log("3. Uploading Image...");
        const formData = new FormData();
        formData.append("content", "Check this image");

        const fileBuffer = fs.readFileSync(path.join(__dirname, 'test-image.png'));
        const blob = new Blob([fileBuffer], { type: 'image/png' });
        formData.append("attachments", blob, "test-image.png");

        const uploadRes = await fetch(`${BASE_URL}/tickets/${ticket._id}/messages`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`
            },
            body: formData
        });

        const message = await uploadRes.json();
        console.log("Message Response:", JSON.stringify(message, null, 2));

        if (message.attachments && message.attachments.length > 0) {
            console.log("✅ Attachment uploaded successfully:", message.attachments[0]);
        } else {
            console.error("❌ No attachment found in response");
        }

    } catch (error) {
        console.error("❌ Test failed:", error);
    }
}

runTest();
