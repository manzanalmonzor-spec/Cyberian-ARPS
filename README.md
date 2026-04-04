<p align="center">
  <img src="Images/ARPLOGO.png" alt="ARPS Logo" width="150">
</p>

<h1 align="center">Antique Risk Prevention System</h1>



<p align="center">
  A system designed to help identify, assess, and manage risks occurring in Western Visayas Antique Region.
</p>



# Table of Contents

- [Team](#team)
- [System Overview](#system-overview)
- [Installation](#installation)
- [Features](#features)
- [Application Walkthrough](#walkthrough)
- [APIs](#application-programming-interface)
- [AI Tools](#use-of-ai-tools)



# Team
The Project is a creation of the Team Cyberians from Saint Anthony's College as an entry for the 𝗞𝗼𝗺𝘀𝗮𝗶 𝗛𝗮𝗰𝗸 𝟮𝟬𝟮𝟲: 𝗥𝗶𝘀𝗸𝗥𝗲𝗮𝗱𝘆 hosted by the University of the Philippines Miag-ao

## Team Members
1. Almonzor Manzan - Hacker/Project Lead
2. Khing Jay Regala - Hacker
3. Alleah Wendine Tejares - Hipster
4. Marl Ellie Alfonga - Hipster
5. Ian Jude C. Fabila - Hustler

<img src="Images/team_pic/1.jpg" alt="Cyberian Team" width="700">
<br>


# System Overview
The Antique Risk Prevention System (ARPS) is a dedicated web application designed to protect the people of Antique by providing real-time tools for disaster preparedness and emergency response. By installing it as a mobile-friendly app, users gain a reliable lifeline that works even during extreme situations when internet access is limited. Residents can instantly send SOS alerts with their precise location, find the safest routes to nearby evacuation centers, and receive live weather updates. For local authorities (MDRRMO), the system serves as a powerful command center to track incoming reports and coordinate fast, life-saving assistance across the province.

# Installation

You can Install the Web Application in your device for a better experience enabling you offline access in cases of extreme emergencies


## Steps to Install
1. Open the [Antique ARPS Web App](https://antique-arps.com) in your Browser.
2. On the landing page on the top right you can **click on the install button**

   <img src="Images/read_img/install.jpg" alt="install image" width="250">
3. After doing so, some of the ARPS features will now be accessible offline.


# Features
* **Offline Access:** Install the application directly to your device home screen. This allows you to access critical safety information and emergency guides even during total internet blackouts, and also has an offline SMS integration for when there is no internet connection available.
* **One-Tap SOS System:** Send immediate emergency alerts to the MDRRMO. The system intelligently uses PhilSMS for internet-based alerts but automatically falls back to your phone’s native SMS app if you are offline.
* **Smart Evacuation Routing:** Find the nearest "Safe Zones" and evacuation centers instantly. The system uses the Overpass API to locate facilities and provides real-time navigation to guide you safely to your destination.
* **Real-Time Weather Intelligence:** Stay ahead of hazards with live weather updates and storm tracking powered by Open-Meteo localized specifically to your current GPS coordinates.
* **Live Incident Mapping:** For administrators, a real-time "Live Map" visualizes all active SOS signals across the municipality, allowing for faster response times and better resource management.




# Walkthrough

## Admin
The Admin page will primarily be handled by the respected MDRRMO in their respective municipalities in Antique in order to receive emergency alerts and define areas with possible hazards and risks.

<details>
  <summary><strong><font color="blue">Click to view: Admin Walkthrough</font></strong></summary>


  **Admin Login:** To ensure secure access, administrators from the MDRRMO must first authenticate using their official credentials on this secure login page. To login to the admin page you can use the account "admin@gmail.com" with the password "admin1234"
  <p><img src="Images/read_admin_walkthrough/10.png" alt="Admin Login" width="800"></p>

  **Admin Dashboard:** The Admin Dashboard provides the operator with a comprehensive overview of all incoming emergency requests from users. This includes critical real-time data, such as the exact location of the user and the specific type of emergency reported.
  <p><img src="Images/read_admin_walkthrough/1.png" alt="Admin Dashboard" width="800"></p>

  **Live Map:** By clicking "Live Maps" on the left navigation menu, the operator is directed to an interactive map displaying real-time, active incident mapping across the municipality, where the operator can visibly see the locations of users' SOS alerts. 
  <p><img src="Images/read_admin_walkthrough/2.png" alt="Live Incident Map" width="800"></p>

  **Alerts:** After clicking "Alerts" on the left navigation menu, the operator will be directed to the Alerts Management page, where they can see the full details and history of SOS reports from users.
  <p><img src="Images/read_admin_walkthrough/3.png" alt="Alerts Management" width="800"></p>


  **Weather:** By tapping "Weather" in the left navigation menu, the operator is directed to the Weather Intelligence page. This displays localized info based on the Open-Meteo API for the municipality's coordinates.
  <p><img src="Images/read_admin_walkthrough/5.png" alt="Weather Intelligence" width="800"></p>

  **User Approval:** In the Users Approval page, the operator/admin can authenticate and approve new user accounts after verifying their submitted identity documents.
  <p><img src="Images/read_admin_walkthrough/7.png" alt="User Approval List" width="800"></p>

  **Settings:** In the settings page, the operator can configure the **Offline Service Number**. This number is used to receive SOS alerts via SMS from users who do not have internet access.
  <p><img src="Images/read_admin_walkthrough/9.png" alt="Admin Settings" width="800"></p>

</details>

## User Walkthrough
The User Dashboard is the main home screen where users can access and interact with all of the app's core features.
<details>
  <summary>
    <strong><font color="blue">Standard User Walkthrough</font></strong>
  </summary>


  ### 1. Login Process
Here is the step-by-step process for users to authenticate and access the system securely.

**Step 1:** Users begin at the ARPS landing page. By tapping the **"Open Citizen App"** button, they will be directed to the Login portal.  
<p>
  <img src="Images/read_user_walkthrough/16.jpg" alt="Main Page 1" width="300"> 
</p>


**Step 2:** New users can register their accounts by inputting their Name, Email, and Password, while returning users can quickly access their accounts via the Sign In page.
<p>
  <img src="Images/read_user_walkthrough/7.jpg" alt="Main Page 1" width="300"> <img src="Images/read_user_walkthrough/13.jpg" alt="Main Page 2" width="300">
</p>

> **Note:** Users only need to perform a **one-time login**. Once authenticated, the system keeps you logged in so that the SOS button and critical emergency features are instantly accessible in high-pressure situations without needing to re-enter credentials.

**Step 3:** In this page, the user will have to input their personal information such as Name, Age, Contact Number, Address, and Gender.
<p><img src="Images/read_user_walkthrough/8.jpg" alt="Personal Info" width="300"></p>

**Step 4:** A facial and ID verification using the phone's camera will be conducted to further authenticate the user which the admins can manually authenticate.
<p>
  <img src="Images/read_user_walkthrough/14.jpg" alt="ID Upload" width="300">
  &nbsp;&nbsp;&nbsp;
  <img src="Images/read_user_walkthrough/9.jpg" alt="Face Verification" width="300">
</p>

> **Anti-Troll Measure:** This verification steps ensures accountability. Any user found sending malicious or fake SOS signals will be identified and reported to authorities for violating **Presidential Decree No. 1727**, which penalizes the dissemination of false information and emergency alarms.

**Step 5:** In this page the user can read and agree to the terms and services of using the ARPS system. 
<p><img src="Images/read_user_walkthrough/10.jpg" alt="Terms and Services" width="300"></p>

**Step 6:** This page confirms the information the user has provided to ensure everything is correct before moving forward.
<p><img src="Images/read_user_walkthrough/11.jpg" alt="Confirm Information" width="300"></p>

**Step 7:** This page confirms the submission and informs the user that their account is pending. They must wait for an administrator to manually verify their submitted ID picture before gaining full access.
<p><img src="Images/read_user_walkthrough/12.jpg" alt="Pending Approval" width="300"></p>

  <br>

  ### 2. Main Dashboard
Once logged in, users are greeted by the main page where they can navigate the system.

**Overview:** The main dashboard gives the user tips and information that can be helpful in times of need. This includes an SOS button, AI-driven contextual tips, and the Nearest Home Shelter based on your current location.

**SOS Button:** When the SOS button is clicked, this page will appear prompting the user to select what kind of emergency they are experiencing so that the appropriate help can be dispatched immediately.
<p><img src="Images/read_user_walkthrough/1.jpg" alt="Main Page 1" width="300"> <img src="Images/read_user_walkthrough/2.jpg" alt="Main Page 2" width="300"></p>

> **Legal Warning:** To protect the integrity of the system and ensure responders are available for real emergencies, **prank reporting is strictly prohibited.** False reports are a criminal offense under **Presidential Decree No. 1727** and **Article 155 of the Revised Penal Code (Alarms and Scandals)**. Violators will be tracked via their verified ID and face legal prosecution.
<br>

> **📡 Offline SOS Capability:** The SOS button is designed to save lives even during total internet blackouts. If no connection is detected:
> 1. The system automatically retrieves your **last recorded location** from the secure local cache.
> 2. It triggers a **fail-safe SMS fallback** to the administrator's emergency line.
> 3. The message includes an automated **Google Maps location link**, allowing responders to navigate to your position using GPS coordinates even without a data signal.

**Reports:** After an SOS is sent, users can track the status of their emergency on the Reports page. This is easily accessible by tapping the Reports icon on the bottom navigation bar. It also provides situational guidance while you wait for help.
<p><img src="Images/read_user_walkthrough/3.jpg" alt="Main Page 3" width="300"></p>


**Settings/Profile:** In the settings page, users can view and edit their profile information to ensure their emergency contact details and health info stay up to date.
<p><img src="Images/read_user_walkthrough/6.jpg" alt="Profile Settings" width="300"></p>

**ARPS AI Assistant:** The system features an integrated AI Assistant that provides real-time, context-aware advice. It offers immediate safety protocols and disaster-preparedness tips tailored to the user's current environment and active hazards.
<p><img src="Images/read_user_walkthrough/15.jpg" alt="ARPS AI Assistant" width="300"></p>

</details>
<br>


# Application Programming Interface
These API'S are the External Services Used in the System

### 1. Nominatim (Address Finder)
* **What it does:** It translates raw GPS coordinates (latitude and longitude) into a readable human location, like "Street, Barangay, Province."
* **How it helps:** When the app detects exactly where you are on the map, it uses this service to figure out your actual street address and display it on the screen.

### 2. BigDataCloud (Backup Address Finder)
* **What it does:** This is our backup tool for finding addresses, specifically tuned to recognize Philippine "Barangays."
* **How it helps:** If the main address finder is running slow or is temporarily unavailable, the app automatically switches to this service so you never lose your location details.

### 3. PhilSMS (Emergency Text Messenger)
* **What it does:** It is a service that sends out automated SMS text messages over the internet.
* **How it helps:** When you press the SOS button, this service instantly texts your emergency contacts with your current location and the type of emergency. If you don't have internet access, the app is smart enough to open your phone's regular texting app so you can still send the message manually.

### 4. Open-Meteo (Live Weather)
* **What it does:** It acts as the app's personal weatherman by checking the conditions at your exact GPS coordinates.
* **How it helps:** It fetches the real-time temperature, wind speed, and weather status (like "Rainy" or "Mostly Clear") and displays them right on your home screen so you can stay informed about the environment around you.

### 5. Overpass API (Safe Zone Locator)
* **What it does:** It acts like a highly specific search engine for buildings on a map.
* **How it helps:** It scans the immediate area around your current location to find nearby evacuation centers, emergency facilities, and barangay halls. It then takes those locations and drops marker pins on your map so you know exactly where to go in an emergency.

# Use of AI Tools

**Tool Used:** 
### Google Gemini

**Role:** Development Assistant & Debugging Support

* **SOS Alert Sound Toggle:** Assisted in structuring and troubleshooting the backend logic for a dedicated audio toggle, ensuring that critical SOS alert sounds can be enabled or muted reliably without affecting the delivery of visual emergency notifications.
* **UI/CSS Troubleshooting:** Helped identify and fix CSS layout and responsiveness issues to maintain a clean user interface.
* **Admin Mapping Integration:** To find the official source of the Leaflet API and retrieve the correct developer settings for the map's foundation.
* **Evacuation Routing Logic:** Aided in refining the data-handling logic used to fetch, filter, and display nearby evacuation centers accurately.