document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");

  function showMessage(text, type = "info") {
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
    messageDiv.classList.remove("hidden");
    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 4000);
  }

  async function loadActivities() {
    activitiesList.innerHTML = "<p>Loading activities...</p>";
    try {
      const res = await fetch("/activities");
      if (!res.ok) throw new Error("Failed to fetch activities");
      const data = await res.json();

      activitiesList.innerHTML = "";
      activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';

      Object.entries(data).forEach(([name, info]) => {
        // populate select
        const opt = document.createElement("option");
        opt.value = name;
        opt.textContent = name;
        activitySelect.appendChild(opt);

        // build activity card
        const card = document.createElement("div");
        card.className = "activity-card";
        card.dataset.activity = name;

        const title = document.createElement("h4");
        title.textContent = name;
        card.appendChild(title);

        const desc = document.createElement("p");
        desc.textContent = info.description;
        card.appendChild(desc);

        const sched = document.createElement("p");
        sched.textContent = `Schedule: ${info.schedule}`;
        card.appendChild(sched);

        const spots = document.createElement("p");
        const remaining = Math.max(0, info.max_participants - (info.participants?.length || 0));
        spots.textContent = `Spots remaining: ${remaining}/${info.max_participants}`;
        card.appendChild(spots);

        // Participants section
        const participantsWrap = document.createElement("div");
        participantsWrap.className = "participants";

        const participantsTitle = document.createElement("span");
        participantsTitle.className = "participants-title";
        participantsTitle.textContent = `Participants (${(info.participants || []).length})`;
        participantsWrap.appendChild(participantsTitle);

        const participantsList = document.createElement("ul");
        participantsList.className = "participants-list";
        // helper to create a participant list item with remove button
        function createParticipantItem(activityName, email) {
          const li = document.createElement("li");
          const span = document.createElement("span");
          span.className = "participant-email";
          span.textContent = email;
          li.appendChild(span);

          const btn = document.createElement("button");
          btn.className = "participant-remove";
          btn.type = "button";
          btn.title = `Unregister ${email}`;
          btn.setAttribute("aria-label", `Unregister ${email}`);
          btn.textContent = "✖";
          btn.addEventListener("click", () => {
            unregisterParticipant(activityName, email, li);
          });
          li.appendChild(btn);
          return li;
        }

        (info.participants || []).forEach((p) => {
          const li = createParticipantItem(name, p);
          participantsList.appendChild(li);
        });
        participantsWrap.appendChild(participantsList);

        card.appendChild(participantsWrap);
        activitiesList.appendChild(card);
      });
    } catch (err) {
      activitiesList.innerHTML = `<p class="error">Unable to load activities.</p>`;
      console.error(err);
    }
  }

  // Helper to reliably find an activity card by its data-activity value.
  function findActivityCard(activityName) {
    const cards = document.querySelectorAll('.activity-card');
    for (const c of cards) {
      if (c.dataset.activity === activityName) return c;
    }
    return null;
  }

  async function unregisterParticipant(activityName, email, liElement) {
    try {
      const url = `/activities/${encodeURIComponent(activityName)}/participants?email=${encodeURIComponent(email)}`;
      const res = await fetch(url, { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = body.detail || body.message || "Unregister failed.";
        showMessage(detail, "error");
        return;
      }

  // remove from DOM and update counts/spots
  const card = findActivityCard(activityName);
      if (card) {
        const list = card.querySelector(".participants-list");
        if (liElement && liElement.parentNode === list) {
          list.removeChild(liElement);
        }
        const title = card.querySelector(".participants-title");
        const currentCount = list.children.length;
        if (title) title.textContent = `Participants (${currentCount})`;
        const spotsP = card.querySelector("p:nth-of-type(3)");
        if (spotsP) {
          const maxText = spotsP.textContent.match(/\/\d+$/);
          if (maxText) {
            const max = parseInt(maxText[0].slice(1), 10);
            const remaining = Math.max(0, max - currentCount);
            spotsP.textContent = `Spots remaining: ${remaining}/${max}`;
          }
        }
      }

      showMessage(`Unregistered ${email} from ${activityName}`, "success");
    } catch (err) {
      console.error(err);
      showMessage("An error occurred while unregistering.", "error");
    }
  }

  async function signup(event) {
    event.preventDefault();
    const emailInput = document.getElementById("email");
    const activityName = activitySelect.value;
    const email = emailInput.value.trim();
    if (!activityName) {
      showMessage("Please select an activity.", "error");
      return;
    }
    if (!email) {
      showMessage("Please enter an email address.", "error");
      return;
    }

    try {
      const url = `/activities/${encodeURIComponent(activityName)}/signup?email=${encodeURIComponent(email)}`;
      const res = await fetch(url, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = body.detail || body.message || "Sign up failed.";
        showMessage(detail, "error");
        return;
      }

  // update UI: find card and append participant
  const card = findActivityCard(activityName);
      if (card) {
        const list = card.querySelector(".participants-list");
        const title = card.querySelector(".participants-title");
        // create list item with remove button
        const span = document.createElement("span");
        span.className = "participant-email";
        span.textContent = email;

        const btn = document.createElement("button");
        btn.className = "participant-remove";
        btn.type = "button";
        btn.title = `Unregister ${email}`;
        btn.setAttribute("aria-label", `Unregister ${email}`);
        btn.textContent = "✖";
        btn.addEventListener("click", () => {
          unregisterParticipant(activityName, email, btn.parentNode);
        });

        const li = document.createElement("li");
        li.appendChild(span);
        li.appendChild(btn);
        list.appendChild(li);

        // update title count and spots remaining
        const currentCount = list.children.length;
        title.textContent = `Participants (${currentCount})`;
        const spotsP = card.querySelector("p:nth-of-type(3)"); // schedule is 2nd p, spots is 3rd p
        if (spotsP) {
          const maxText = spotsP.textContent.match(/\/\d+$/);
          if (maxText) {
            const max = parseInt(maxText[0].slice(1), 10);
            const remaining = Math.max(0, max - currentCount);
            spotsP.textContent = `Spots remaining: ${remaining}/${max}`;
          }
        }
      }

      showMessage(`Signed up ${email} for ${activityName}`, "success");
      signupForm.reset();
    } catch (err) {
      console.error(err);
      showMessage("An error occurred while signing up.", "error");
    }
  }

  signupForm.addEventListener("submit", signup);

  loadActivities();
});
