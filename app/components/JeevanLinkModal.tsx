"use client";

import { useState } from "react";
import type { CivilianMessage, CivilianSOSRequest } from "../types/mission";

interface JeevanLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  connectedDrone: string;
  onSendSOS: (request: CivilianSOSRequest) => void;
  onSendMessage: (text: string) => void;
  messages: CivilianMessage[];
}

export default function JeevanLinkModal({
  isOpen,
  onClose,
  connectedDrone,
  onSendSOS,
  onSendMessage,
  messages,
}: JeevanLinkModalProps) {
  const [activeTab, setActiveTab] = useState<"sos" | "compass" | "chat" | "guide">("sos");
  const [headcount, setHeadcount] = useState(3);
  const [medical, setMedical] = useState("Elderly family member, mild hypothermia");
  const [urgency, setUrgency] = useState<"urgent" | "critical">("critical");
  const [notes, setNotes] = useState("Trapped on temple terrace near Harsil bridge, water rising.");
  const [sosSent, setSosSent] = useState(false);
  const [inputText, setInputText] = useState("");

  if (!isOpen) return null;

  function handleTransmitSOS() {
    setSosSent(true);
    onSendSOS({
      headcount,
      medicalCondition: medical,
      urgency,
      gridX: 62.2,
      gridY: 34.5,
      notes,
    });
  }

  function handleSendChat(e: React.FormEvent) {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText("");
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="phone-modal-wrapper"
        role="dialog"
        aria-modal="true"
        aria-label="JeevanLink Civilian Smartphone Portal"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="phone-device-frame">
          {/* Phone Speaker & Camera Notch */}
          <div className="phone-notch">
            <span className="phone-speaker" />
            <span className="phone-lens" />
          </div>

          {/* Phone Status Bar */}
          <div className="phone-status-bar">
            <span>09:41</span>
            <div className="phone-network-chips">
              <span className="phone-mesh-badge">
                <i className="mesh-dot" /> {connectedDrone} (P2P Mesh)
              </span>
              <span className="phone-no-cellular">No Cell Service</span>
              <span className="phone-battery">84%</span>
            </div>
          </div>

          {/* Emergency Alert Banner */}
          <div className="civilian-alert-banner">
            <span className="alert-pulse">!</span>
            <div>
              <strong>OFFLINE RESCUE PORTAL</strong>
              <small>Connected via Autonomous Drone {connectedDrone} · No Internet</small>
            </div>
            <button className="phone-close-button" onClick={onClose} aria-label="Close portal">
              ✕
            </button>
          </div>

          {/* Phone Navigation Tabs */}
          <div className="phone-tab-bar" role="tablist">
            <button
              className={activeTab === "sos" ? "active" : ""}
              onClick={() => setActiveTab("sos")}
              role="tab"
            >
              🚨 Emergency SOS
            </button>
            <button
              className={activeTab === "compass" ? "active" : ""}
              onClick={() => setActiveTab("compass")}
              role="tab"
            >
              🧭 Safe Haven
            </button>
            <button
              className={activeTab === "chat" ? "active" : ""}
              onClick={() => setActiveTab("chat")}
              role="tab"
            >
              💬 Swarm Chat
            </button>
            <button
              className={activeTab === "guide" ? "active" : ""}
              onClick={() => setActiveTab("guide")}
              role="tab"
            >
              📖 Survival
            </button>
          </div>

          {/* Tab Content */}
          <div className="phone-content-body">
            {activeTab === "sos" && (
              <div className="sos-panel">
                {sosSent ? (
                  <div className="sos-confirmed-card">
                    <div className="beacon-waves">
                      <span className="wave w1" />
                      <span className="wave w2" />
                      <span className="wave w3" />
                      <div className="beacon-core">✓</div>
                    </div>
                    <h3>DISTRESS BEACON TRANSMITTED</h3>
                    <p className="sos-status-tag">
                      RECEIVED BY DRONE {connectedDrone} · STORED IN MISSION LEDGER
                    </p>
                    <div className="sos-summary-box">
                      <div><span>People:</span><b>{headcount} Survivors</b></div>
                      <div><span>Urgency:</span><b className="text-red-500">{urgency.toUpperCase()}</b></div>
                      <div><span>Relay Point:</span><b>Overhead ({connectedDrone})</b></div>
                      <div><span>Est. Distance:</span><b>320m Direct Line of Sight</b></div>
                    </div>
                    <div className="sos-advice">
                      <strong>Commander advice to survivors:</strong>
                      <p>Stay on high ground. A second verifier drone is flying over Sector A. Keep bright fabrics or flashlights visible.</p>
                    </div>
                    <button
                      className="sos-retransmit-button"
                      onClick={() => setSosSent(false)}
                    >
                      Update / Retransmit Distress Ping
                    </button>
                  </div>
                ) : (
                  <div className="sos-form">
                    <div className="sos-form-header">
                      <h3>One-Touch Distress Beacon</h3>
                      <p>
                        Your device is directly connected to JeevanMesh swarm radios. Your signal reaches search-and-rescue teams without cellular network.
                      </p>
                    </div>

                    <div className="form-group">
                      <label>Number of trapped people</label>
                      <div className="headcount-selector">
                        {[1, 2, 3, 4, 5, 8, 12].map((num) => (
                          <button
                            key={num}
                            type="button"
                            className={headcount === num ? "selected" : ""}
                            onClick={() => setHeadcount(num)}
                          >
                            {num}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Urgency Level</label>
                      <div className="urgency-selector">
                        <button
                          type="button"
                          className={urgency === "urgent" ? "selected orange" : ""}
                          onClick={() => setUrgency("urgent")}
                        >
                          Urgent (Safe but cut off)
                        </button>
                        <button
                          type="button"
                          className={urgency === "critical" ? "selected red" : ""}
                          onClick={() => setUrgency("critical")}
                        >
                          Critical (Injured / Rising water)
                        </button>
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Medical Needs</label>
                      <input
                        type="text"
                        value={medical}
                        onChange={(e) => setMedical(e.target.value)}
                        placeholder="e.g. Hypothermia, bleeding, elderly, infants"
                      />
                    </div>

                    <div className="form-group">
                      <label>Landmark / Exact Location Description</label>
                      <textarea
                        rows={2}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="e.g. Rooftop of blue building near bridge"
                      />
                    </div>

                    <button
                      className="transmit-sos-button"
                      onClick={handleTransmitSOS}
                    >
                      <span>📡</span> TRANSMIT SOS OVER MESH
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === "compass" && (
              <div className="compass-panel">
                <div className="compass-visual">
                  <div className="compass-dial">
                    <span className="compass-needle" style={{ transform: "rotate(24deg)" }}>
                      <span className="needle-north" />
                      <span className="needle-south" />
                    </span>
                    <span className="compass-cardinal n">N</span>
                    <span className="compass-cardinal e">E</span>
                    <span className="compass-cardinal s">S</span>
                    <span className="compass-cardinal w">W</span>
                  </div>
                  <div className="compass-degrees">
                    <strong>024° NNE</strong>
                    <small>HEADING TO SAFETY</small>
                  </div>
                </div>

                <div className="shelter-card">
                  <span className="shelter-badge">VERIFIED SAFE HAVEN</span>
                  <h4>Govt Higher Secondary School, Dharali</h4>
                  <div className="shelter-stats">
                    <div><span>Distance</span><b>640 m</b></div>
                    <div><span>Elevation</span><b>+135 m (Safe)</b></div>
                    <div><span>Est. Time</span><b>15 mins</b></div>
                  </div>
                  <div className="safe-route-note">
                    <strong>⚠️ AVOID RIVERBANK ROAD:</strong>
                    <p>D2 confirmed a landslide blocked Grid 38, 61. Take the North ridge footpath behind the pine ridge.</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "chat" && (
              <div className="chat-panel">
                <div className="chat-disclaimer">
                  <span>📶 Tactical 40-char Compressed Mesh Packets</span>
                </div>
                <div className="chat-messages-container">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`chat-bubble ${msg.sender === "civilian" ? "mine" : "commander"}`}
                    >
                      <span className="chat-sender">
                        {msg.sender === "civilian" ? "You (Civilian)" : "JeevanMesh Commander"}
                      </span>
                      <p>{msg.text}</p>
                      <span className="chat-time">{msg.time}</span>
                    </div>
                  ))}
                </div>

                <form className="chat-input-row" onSubmit={handleSendChat}>
                  <input
                    type="text"
                    maxLength={120}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Type short message to rescue swarm..."
                  />
                  <button type="submit">Send</button>
                </form>
              </div>
            )}

            {activeTab === "guide" && (
              <div className="survival-guide-panel">
                <h3>Offline Himalayan Flood Survival</h3>
                <div className="guide-card">
                  <strong>1. Signal Drones from Overhead</strong>
                  <p>Lay out brightly colored cloth (orange, blue tarps). In daylight, reflect sunlight toward drones using phone screens or mirrors.</p>
                </div>
                <div className="guide-card">
                  <strong>2. Drinking Water Safety</strong>
                  <p>Never drink flood runoff. Collect rainwater in clean receptacles or boil flood water for at least 3 minutes.</p>
                </div>
                <div className="guide-card">
                  <strong>3. Prevent Mountain Hypothermia</strong>
                  <p>Wring out wet clothing. Huddle together away from cold drafts. Insulate your feet from wet concrete or mud using dry cardboard or branches.</p>
                </div>
                <div className="guide-card">
                  <strong>4. Smartphone Battery Conservation</strong>
                  <p>Keep your phone in Airplane Mode with only Wi-Fi enabled to communicate with passing JeevanMesh drones.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
