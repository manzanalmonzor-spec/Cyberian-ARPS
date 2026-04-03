<p align="center">
  <img src="images/ARPLOGO.png" alt="ARPS Logo" width="150">
</p>

<h1 align="center">Antique Risk Prevention System</h1>



<p align="center">
  A system designed to help identify, assess, and manage risks occuring in Western Visayas Antique Region.
</p>



# Table of Contents

- [Team](#team)
- [System Overview](#system-overview)
- [Installation](#installation)
- [Features](#features)
- [Application Walkthrough](#walkthrough)
- [API's](#application-programming-interface)
- [AI Tools](#use-of-ai-tools)



# Team
The Project is a creation of the Team Cyberians from Saint Anthony's College as an entry for the 𝗞𝗼𝗺𝘀𝗮𝗶 𝗛𝗮𝗰𝗸 𝟮𝟬𝟮𝟲: 𝗥𝗶𝘀𝗸𝗥𝗲𝗮𝗱𝘆 hosted by the University of the Philippines Miag-ao

## Team Members
1. Almonzor Manzan - Project Lead and Developer
2. Khing Jay Regala - Project Developer
3. Alleah Wendine Tejares - Spokesperson
4. Marl Ellie Alfonga - Spokesperson
5. Ian Jude C. Fabila - Documentator

<img src="images/team_pic/1.jpg" alt="Cyberian Team" width="700">
<br>


# System Overview
The Antique Risk Prevention System (ARPS) is a dedicated web application designed to protect the people of Antique by providing real-time tools for disaster preparedness and emergency response. By installing it as a mobile-friendly app, users gain a reliable lifeline that works even during extreme situations when internet access is limited. Residents can instantly send SOS alerts with their precise location, find the safest routes to nearby evacuation centers, and receive live weather updates. For local authorities (MDRRMO), the system serves as a powerful command center to track incoming reports and coordinate fast, life-saving assistance across the province.

# Installation

You can Install the Web Application in your device for a better experience enabling you offline access in cases of extreme emergencies


## Steps to Install
1. Open the [Antique ARPS Web App](https://antique-arps.com) in your Browser.
2. On the landing page on the top right you can **click on the install button**

   <img src="images/read_img/install.png" alt="install image" width="250">
3. After doing so, some of the ARPS features will now be accessible offline.


# Features
* **Offline Access:** Install the application directly to your device home screen. This allows you to access critical safety information and emergency guides even during total internet blackouts.
* **One-Tap SOS System:** Send immediate emergency alerts to the MDRRMO. The system intelligently uses PhilSMS for internet-based alerts but automatically falls back to your phone’s native SMS app if you are offline.
* **Smart Evacuation Routing:** Find the nearest "Safe Zones" and evacuation centers instantly. The system uses the Overpass API to locate facilities and provides real-time navigation to guide you safely to your destination.
* **Real-Time Weather Intelligence:** Stay ahead of hazards with live weather updates and storm tracking powered by Open-Meteo localized specifically to your current GPS coordinates.
* **Live Incident Mapping:** For administrators, a real-time "Live Map" visualizes all active SOS signals across the municipality, allowing for faster response times and better resource management.

* **One-Tap SOS System:** Send immediate emergency alerts to the MDRRMO. The system intelligently uses PhilSMS for internet-based alerts but automatically falls back to your phone’s native SMS app if you are offline.




# Walkthrough


</details>

## Admin
  The Admin page will primarily be handled by the respected MDRRMO in their respected municipalities in Antique in order to receive emergency alerts and define areas with possible hazards and risks.
<details>
  <summary><strong><font color ="blue">Click to view: Admin Walkthrough</font></strong></summary>
  <br>

   **Admin Dashboard:** The Admin Dashboard provides the operator with a comprehensive overview of all incoming emergency requests from users. This includes critical real-time data, such as the exact location of the user and the specific type of emergency reported.
  <p><img src="images/read_admin_walkthrough/1.jpg" alt="Main Page 1" width="800"></p>

  **Live Map:** By clicking "Live Maps" on the left navigation menu, the operator is directed to an interactive map displaying real-time, active incident mapping across the municipality where the operator can visibly see where users SOS alerts are. 
  <p><img src="images/read_admin_walkthrough/2.jpg" alt="Main Page 2" width="800"></p>

  **Alerts:** After clicking the "Alerts" on the left navigation menu, the operator will be directed to the Alerts Management page where they will be able to see the details of SOS reports from the users.
  <p><img src="images/read_admin_walkthrough/3.jpg" alt="Main Page 3" width="800"></p>

 **Centers:** By tapping "Centers" in the left navigation menu, the operator will be able to know the capacity of evacuation centers along with their details.
  <p>
    <img src="images/read_admin_walkthrough/4.jpg" alt="Evacuation Centers" width="800">
  </p>

  **Weather:** By tapping "Weather" in the left navigation menu, the operator will be directed to the Weather Intelligence page where weather info based on the Open-Meteo API and current location of the operator will be displayed.
  <p><img src="images/read_admin_walkthrough/5.jpg" alt="Main Page 6" width="800">
  &nbsp;&nbsp;&nbsp;
  <img src="images/read_admin_walkthrough/6.jpg" alt="Route Navigation" width="800"></p>

  **User Approval:** In the Users Approval page, the operator/admin can authenticate new user accounts.
  <p><img src="images/read_admin_walkthrough/7.jpg" alt="Main Page 6" width="800">
  &nbsp;&nbsp;&nbsp;
  <img src="images/read_admin_walkthrough/8.jpg" alt="Route Navigation" width="800"></p>

  **Settings:** In the settings page the operator can change the offline service number, this number will be used for receiving SOS alerts even if the user doesn't have online access using the Philsys API
  <p>
    <img src="images/read_admin_walkthrough/4.jpg" alt="Evacuation Centers" width="800">
  </p>



</details>

## User Walkthrough
The User Dashboard is the main home screen where users can access and interact with all of the app's core features.
<details>
  <summary>
    <strong><font color="blue">Standard User Walkthrough</font></strong>
  </summary>
  <br>

  ### 1. Login Process
  Here is the step-by-step process for users to authenticate and access the system securely.
  
  **Step 1.1:** First time users can register their accounts in this Sign In page by inputting their Name, Email, and Password.
  <p><img src="images/read_user_walkthrough/7.jpg" alt="Sign Up" width="300"></p>

  **Step 1.2:** Returning users may access their account using this Sign Up page by inputting their Email, and Password.
  <p><img src="images/read_user_walkthrough/13.jpg" alt="Sign In" width="300"></p>

  **Step 2:** In this page, the user will have to input their personal information such as Name, Age, Contact Number, Address, and Gender.
  <p><img src="images/read_user_walkthrough/8.jpg" alt="Login Step 3" width="300"></p>

  **Step 3:** A facial and ID verification using the phone's camera will be conducted to further authenticate the user and prevent trolls or fake accounts from accessing the system.
  <p><img src="images/read_user_walkthrough/9.jpg" alt="Login Step 4" width="300"></p>

  **Step 4:** In this page the user can read and agree to the terms and services of using the ARPS system. 
  <p><img src="images/read_user_walkthrough/10.jpg" alt="Login Step 5" width="300"></p>

  **Step 5:** This page confirms the information the user has provided to ensure everything is correct before moving forward.
  <p><img src="images/read_user_walkthrough/11.jpg" alt="Login Step 6" width="300"></p>

  **Step 6:** This page confirms the submission and informs the user that their account is pending. They must wait for an administrator to manually verify their submitted ID picture before gaining full access.
  <p><img src="images/read_user_walkthrough/12.jpg" alt="Login Step 7" width="300"></p>

  <hr>

  ### 2. Main Dashboard
  Once logged in, users are greeted by the main page where they can navigate the system.

  **Overview:** The main dashboard gives the user tips and information that can be helpful in times of need. this includes an SOS button, AI driven contextual tips, and Nearest Home Shelter based on location.
  <p><img src="images/read_user_walkthrough/1.jpg" alt="Main Page 1" width="300"></p>

  **SOS Button:** When the SOS button is clicked, this page will appear prompting the user what kind of emergency he/she is experiencing in order to identify what kind of help should be sent to him/her.
  <p><img src="images/read_user_walkthrough/2.jpg" alt="Main Page 2" width="300"></p>

  **Reports:** After an SOS is sent, users can track the status of their emergency on the Reports page. This is easily accessible by tapping the Reports icon on the bottom navigation bar. There is also additional information on what to do based on the situation.
  <p><img src="images/read_user_walkthrough/3.jpg" alt="Main Page 3" width="300"></p>

 **Centers & Routing:** By tapping "Centers" in the bottom navigation menu, users can easily locate the nearest evacuation center. The app will also calculate and display the best route to safely guide the user to their destination.
  <p>
    <img src="images/read_user_walkthrough/4.jpg" alt="Evacuation Centers" height="550">
    &nbsp;&nbsp;&nbsp;
    <img src="images/read_user_walkthrough/5.jpg" alt="Route Navigation" height="550">
  </p>

  **Settings/Profile:** By tapping "Settings" in the bottom navigation menu, users will be directed to the settings page where the user can see and edit their profile.
  <p><img src="images/read_user_walkthrough/6.jpg" alt="Main Page 6" width="300"></p>

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

* **Notification System Logic:** Assisted in structuring and troubleshooting the backend code logic to ensure reliable delivery of alerts and notifications.
* **UI/CSS Troubleshooting:** Helped identify and fix CSS layout and responsiveness issues to maintain a clean user interface.
* **Admin Mapping Integration:** To find the official source of the Leaflet API and retrieve the correct developer settings for the map's foundation.
* **Evacuation Routing Logic:** Aided in refining the data-handling logic used to fetch, filter, and display nearby evacuation centers accurately.
<br>
### Anthropic Claude
**Role:** Repository Management & Architectural Contributor
<br>
 

**Please note:** * You may notice **Claude** listed as a contributor in this repository's history. This is a technical artifact from the initial setup phase where AI-assisted repository initialization was briefly tested. **No code generated by Claude remains in the current system.** 