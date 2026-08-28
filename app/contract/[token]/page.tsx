"use client";
import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";

interface ContractData {
  id: string; employee_name: string; nrc_number: string; ssn: string; home_address: string;
  position: string; branch_name: string; effective_date: string; end_date: string;
  basic_pay: number; housing_allowance: number; other_allowances: number; gross_salary: number;
  status: string; signed_at: string; signature_data: string; signed_name: string;
}

function fmt(n: number) { return n.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtDate(d: string) { if (!d) return "_______________"; return new Date(d+"T00:00:00").toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"}); }
function fmtPos(p: string) { return p==="SUPERVISOR"?"Supervisor":(p||"").replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase()); }

export default function ContractPage() {
  const params = useParams();
  const token = params.token as string;
  const [data, setData] = useState<ContractData|null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);
  const [signing, setSigning] = useState(false);
  const [signedName, setSignedName] = useState("");
  const [signed, setSigned] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/contract-view?token=${token}`);
        if (!res.ok) { setError("Contract not found or link has expired."); setLoading(false); return; }
        setData(await res.json());
      } catch { setError("Failed to load contract."); }
      setLoading(false);
    };
    if (token) load();
  }, [token]);

  const getPos = (e: any) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const x = (e.touches?e.touches[0].clientX:e.clientX)-rect.left;
    const y = (e.touches?e.touches[0].clientY:e.clientY)-rect.top;
    return { x: x*(canvas.width/rect.width), y: y*(canvas.height/rect.height) };
  };
  const startDraw = (e: any) => { e.preventDefault(); const ctx=canvasRef.current?.getContext("2d"); if(!ctx)return; setIsDrawing(true); setHasDrawn(true); const{x,y}=getPos(e); ctx.beginPath(); ctx.moveTo(x,y); };
  const draw = (e: any) => { e.preventDefault(); if(!isDrawing)return; const ctx=canvasRef.current?.getContext("2d"); if(!ctx)return; const{x,y}=getPos(e); ctx.lineTo(x,y); ctx.stroke(); };
  const endDraw = () => setIsDrawing(false);
  const clearSig = () => { const ctx=canvasRef.current?.getContext("2d"); if(!ctx)return; ctx.clearRect(0,0,canvasRef.current!.width,canvasRef.current!.height); setHasDrawn(false); };

  useEffect(() => {
    const canvas=canvasRef.current; if(!canvas)return;
    const ctx=canvas.getContext("2d"); if(!ctx)return;
    ctx.strokeStyle="#000"; ctx.lineWidth=2; ctx.lineCap="round"; ctx.lineJoin="round";
  }, [data]);

  const submitSignature = async () => {
    if(!hasDrawn||!signedName.trim())return;
    setSigning(true);
    const sigData = canvasRef.current?.toDataURL("image/png")||"";
    try {
      const res = await fetch("/api/contract-sign", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({token,signature_data:sigData,signed_name:signedName.trim()}) });
      if(res.ok) setSigned(true); else { const d=await res.json(); alert(d.error||"Failed to sign"); }
    } catch { alert("Failed to submit signature"); }
    setSigning(false);
  };

  const W:React.CSSProperties = { position:"fixed",inset:0,overflow:"auto",background:"#f5f5f5",fontFamily:"Georgia,'Times New Roman',serif",padding:"20px",zIndex:9999,color:"#000" };
  const P:React.CSSProperties = { fontSize:"12px",lineHeight:"1.8",marginBottom:"10px",textAlign:"justify",color:"#1a1a1a" };
  const H:React.CSSProperties = { fontSize:"13px",fontWeight:"bold",marginBottom:"6px",color:"#000" };
  const S:React.CSSProperties = { marginBottom:"16px" };

  if(loading) return <div style={{...W,display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{fontSize:"16px",color:"#666"}}>Loading contract...</div></div>;
  if(error||!data) return <div style={{...W,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:"12px"}}><div style={{fontSize:"48px"}}>🔒</div><div style={{fontSize:"18px",fontWeight:"bold",color:"#333"}}>Contract Not Found</div><div style={{fontSize:"14px",color:"#666"}}>{error}</div></div>;
  const oa = data.other_allowances||0;
  const blank = "_______________";
  const isSigned = signed || data.status === "signed";

  if (isSigned) return (
    <div style={{...W,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:"12px"}}>
      <div style={{fontSize:"48px"}}>✅</div>
      <div style={{fontSize:"20px",fontWeight:"bold",color:"#333"}}>Contract Signed</div>
      <div style={{fontSize:"14px",color:"#666"}}>{data.signed_at ? `Signed on ${new Date(data.signed_at).toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})}` : "Thank you for signing your employment contract."}</div>
      <div style={{fontSize:"12px",color:"#999",marginTop:"12px"}}>Silverspring Entertainment Ltd | BwanaBet</div>
    </div>
  );

  return (
    <div style={W}>
      <div style={{maxWidth:"750px",margin:"0 auto",background:"#fff",padding:"40px 48px",border:"1px solid #ddd"}}>

        <div style={{textAlign:"center",marginBottom:"30px"}}>
          <h1 style={{fontSize:"18px",fontWeight:"bold",letterSpacing:"1px",marginBottom:"20px",color:"#000"}}>FIXED TERM EMPLOYMENT CONTRACT</h1>
          <p style={P}>BETWEEN</p>
          <p style={{...P,fontWeight:"bold"}}>SILVERSPRING ENTERTAINMENT LIMITED – TRADING AS "BWANA BET"</p>
          <p style={P}>AND</p>
          <p style={{...P,fontWeight:"bold"}}>{data.employee_name.toUpperCase()}</p>
        </div>

        <hr style={{border:"none",borderTop:"1px solid #ccc",margin:"20px 0"}} />

        <div style={{textAlign:"center",marginBottom:"20px"}}><h2 style={{fontSize:"16px",fontWeight:"bold",color:"#000"}}>FIXED TERM EMPLOYMENT CONTRACT</h2></div>

        <p style={P}>THIS FIXED TERM EMPLOYMENT CONTRACT ("Contract") dated {fmtDate(data.effective_date)} (the "Effective Date") is made between SILVERSPRING ENTERTAINMENT LIMITED, TRADING AS "BWANA BET" with an office at Plot 14/5B Twin Palm Road. Kabulonga, Lusaka, Zambia, (hereinafter referred to as the "Company"),</p>
        <p style={P}>AND</p>
        <div style={{marginBottom:"16px",fontSize:"12px",lineHeight:"2.2",color:"#1a1a1a"}}>
          <div>Name: <strong>{data.employee_name}</strong></div>
          <div>NRC Number: <strong>{data.nrc_number||blank}</strong></div>
          <div>Social Security Number: <strong>{data.ssn||blank}</strong></div>
          <div>Residing at the address: <strong>{data.home_address||blank}</strong></div>
        </div>
        <p style={P}>(hereinafter referred to as the "Employee"), for the purpose of setting forth the exclusive terms and conditions of employment.</p>
        <p style={P}>In consideration of the mutual obligations specified in this Agreement, the parties, intending to be legally bound hereby, agree to the following:</p>

        <div style={S}><h3 style={H}>1. AGREEMENT</h3><p style={P}>The company shall on and from {fmtDate(data.effective_date)} enter onto employment of the Employee on a contract of employment of the duration of ONE (01) year, ending on {fmtDate(data.end_date)} and shall be employed in the position of {fmtPos(data.position)} at {data.branch_name}.</p></div>

        <div style={S}><h3 style={H}>2. JOB TITLE</h3>
          <p style={P}>Duties and responsibilities. The duties and responsibilities of the position shall be described by the immediate supervisor or in a separate document titled "Job Description".</p>
          <p style={P}>Employee performance appraisal. The employee performance shall be reviewed after the Probation Period, which shall run for Three (03) Months from the starting date. The employer shall conduct a performance evaluation of the Employee, at least once per calendar year, or at any time it may be deemed necessary.</p>
        </div>

        <div style={S}><h3 style={H}>3. FIXED-TERM CONTRACT</h3><p style={P}>On the completion of the contract, the employment will be deemed to have been fulfilled with no continuing liability whatsoever from either party. Therefore service under this Contract shall not be deemed continuous. This Contract shall be deemed expired at the end of the fixed-term stated above, unless it is renewed by mutual agreement between the Parties.</p></div>

        <div style={S}><h3 style={H}>4. PROBATIONARY PERIOD</h3><p style={P}>Probationary period shall be for the period of THREE (03) MONTHS during which time employment may be terminated by 24 hours' notice be either party, or a day's pay in lieu of notice. If the Employee successfully completes the Probationary Period, the Employer shall confirm the appointment in writing.</p></div>

        <div style={S}><h3 style={H}>5. TERMINATION OF CONTRACT</h3>
          <p style={P}>After successfully completing the Probationary Period, either Party may terminate this contract by giving notice of ONE (01) MONTH, or in the case of the Company, pay in lieu of notice, with a valid reason in accordance with Section 5(a) and (b) of the Labour Act No. 15 of 2015, and any other prevailing legislation, except in case of summary dismissal, which shall have the immediate effect of terminating the Contract without any additional liability on the part of the employer except the following Termination benefits:</p>
          <p style={{...P,fontWeight:"bold"}}>Normal Contract Termination:</p>
          <p style={P}>(a) Pay worked for up to date of termination;<br/>(b) One (1) month's salary in lieu of notice, if either party does not agree to work notice period;<br/>(c) Accrued leave days' pay (if any);<br/>(d) Less Debt/Owings to the company (if any)<br/>(e) Accrued gratuity prorated<br/>(f) Reference of service</p>
          <p style={{...P,fontWeight:"bold"}}>Summary Dismissal:</p>
          <p style={P}>(a) Pay worked for up to date of termination;<br/>(b) Accrued leave days' pay (if any);<br/>(c) Less Debt/Owings to the company (if any)<br/>(d) Accrued gratuity prorated<br/>(e) Reference of service</p>
        </div>

        <div style={S}><h3 style={H}>6. REMUNERATION</h3>
          <p style={P}>(a) In exchange for the full, prompt, and satisfactory performance of all Services rendered to the Company (as determined by the Company), Company shall provide Employee, monthly remuneration but calculated on days worked as hereunder to be paid on a date set by the Company each month.</p>
          <table style={{width:"80%",margin:"12px 0",fontSize:"12px",borderCollapse:"collapse",color:"#1a1a1a"}}><tbody>
            <tr><td style={{padding:"6px 8px",border:"1px solid #ccc"}}>basic monthly salary</td><td style={{padding:"6px 8px",border:"1px solid #ccc",textAlign:"right"}}>ZMW {fmt(data.basic_pay)} per month</td></tr>
            <tr><td style={{padding:"6px 8px",border:"1px solid #ccc"}}>housing allowance (30% basic salary)</td><td style={{padding:"6px 8px",border:"1px solid #ccc",textAlign:"right"}}>ZMW {fmt(data.housing_allowance)} per month</td></tr>
            <tr><td style={{padding:"6px 8px",border:"1px solid #ccc"}}>other work allowances</td><td style={{padding:"6px 8px",border:"1px solid #ccc",textAlign:"right"}}>ZMW {fmt(oa)} per month</td></tr>
            <tr style={{fontWeight:"bold"}}><td style={{padding:"6px 8px",border:"1px solid #ccc"}}>Total gross salary</td><td style={{padding:"6px 8px",border:"1px solid #ccc",textAlign:"right"}}>ZMW {fmt(data.gross_salary)} per month</td></tr>
          </tbody></table>
          <p style={P}>Including Annual Gratuity @25% of accrued basic pay to be paid after completion of the last month of the contract.</p>
          <p style={P}>(b) As required by law, the Company shall withhold all sums and/or payments due by the employee for social security, tax liabilities and mandatory contributions, namely: PAYE, NAPSA and NHIMA.</p>
          <p style={P}>(c) The Company reserves the right to adjust the monthly salary based on DAYS WORKED by Employee.</p>
        </div>

        <div style={S}><h3 style={H}>7. DETERMINATION OF RATE OF SALARY</h3><p style={P}>The rate of Basic Pay is determined solely by the Employer with due regard to the nature of work to be performed and the Employer assessment of the ability of the Employee to perform the Job as well as Company' ability to pay. Furthermore, the basic salary may be adjusted upward at any point during the contract at the sole discretion of the Company.</p></div>

        <div style={S}><h3 style={H}>8. HOURS OF WORK</h3><p style={P}>Normal hours of work shall be 50 hours per week, however due to the nature of our industry the Employee will be require to work non-standard hours ranging between 48 and 54 hours and Management will work with the Employee to determine a time-table to suit operational demands and requirements. The Employee understands and accepts that the Employee may be required to attend to work issues during off days, leave days, and off-work hours, which shall be compensated either by a commensurate substitution of work hours or by paid overtime.</p></div>

        <div style={S}><h3 style={H}>9. OVERTIME</h3><p style={P}>Overtime must be duly authorised by Management for specific needs and which is worked after your normal daily working schedule, shall be paid at the Company's approved standard rate. Employee acknowledges that our operational days include Sundays and Public Holidays and are considered normal working days and shall NOT be observed as "overtime".</p></div>

        <div style={S}><h3 style={H}>10. LEAVE</h3>
          <p style={{...P,fontWeight:"bold"}}>(a) ANNUAL LEAVE</p>
          <p style={P}>Employee shall be entitled to accumulated leave days, calculated as: TWO (02) working days leave per each month worked. Such leave may be taken only after notification and approval by the employer. Notice and application for leave must be given at least 7 days before. The employee shall qualify for leave after working for six months continuous service.</p>
          <p style={{...P,fontWeight:"bold"}}>(b) PAID SICK LEAVE</p>
          <p style={P}>Any absence from duty on grounds of sickness shall be notified to the company within 24 hours and shall be supported by company approved registered Doctor's Certificate or medical diagnosis on letter headed paper, signed by a named and licensed medical practitioner, or from a company designated medical practitioner or institution which shall state explicitly the nature of illness. It is up to Manager's discretion to accept the Doctor's Certificate or request additional proof where there it is reasonable. If additional proof cannot be provided it is up to Manager's Discretion to review Paid Sick Leave entitlement.</p>
          <p style={P}>An employee may choose to take an unlimited amount of UNPAID Sick Leave as the situation demands it by notifying management.</p>
          <p style={{...P,fontWeight:"bold"}}>(c) PROLONGED SICK LEAVE</p>
          <p style={P}>Sick leave may be considered and granted with basic salary paid for a maximum of 90 days and at half of the basic salary for a further period of 90 consecutive days based on the recommendation of a Medical Professional recognised by the Company as being competent and certified to issue such a recommendation. The final decision to approve the Prolonged Sick Leave, or not, rests solely with Company Management. Any instances of fraud shall be prosecuted to the full extent of the law.</p>
        </div>

        <div style={S}><h3 style={H}>11. MEDICAL DISCHARGE</h3><p style={P}>Subject to the recommendation of a Company approved registered Medical Practioner and if the Company is of the opinion that the employee will be unable to perform his/her duties to an acceptable standard (as determined by the Company) by reason of disability through continued sickness, the employee will be medically discharged and shall be paid not less that TWO (02) months basic salary for each completed year of service to the company pro-rata of the running contract.</p></div>

        <div style={S}><h3 style={H}>12. MATERNITY LEAVE</h3><p style={P}>Female employees, who have served the company for a period of TWO (02) YEAR employment contract with the company, shall be granted ONE HUNDRED AND TWENTY (120) days maternity leave with basic pay. Further entitlement will be after a further period of TWO (02) years starting from the date of return to full duties.</p></div>

        <div style={S}><h3 style={H}>13. FEMALE LEAVE</h3><p style={P}>Further to Section 47 of the Employment Code No 3, 2019, every female employee shall be entitled to a ONE (01) day absence from work each month without the requirement to produce a valid medical certificate.</p></div>

        <div style={S}><h3 style={H}>14. PATERNITY LEAVE</h3><p style={P}>Male employees shall be entitled to FIVE (05) days paid Paternity leave on production of a birth certificate or record of birth of the employee's biological child. Paternity Leave entitlement shall only apply to legally married couples and the employer must be shown details and copies of documentation relating to the Spouse. Paternity leave shall be in addition to any other leave which the employee may be entitled to.</p></div>

        <div style={S}><h3 style={H}>15. FAMILY RESPONSIBILITY LEAVE</h3><p style={P}>All employees shall be entitled to Seven (07) days paid leave in a prorated year worked to enable nursing of sick spouses, children or dependents and an additional Three (03) days paid leave per prorated year worked to cover responsibilities related to care, health or education of their children, spouses or dependents.</p></div>

        <div style={S}><h3 style={H}>16. FUNERAL ASSISTANCE</h3>
          <p style={P}>In the event of the death of an employee, Spouse and or/ biological child below 18 years of age, the employer shall provide the following:</p>
          <p style={P}>a standard coffin, or an amount equivalent to purchase one.</p>
          <p style={P}>a Funeral grant of ZMW 1,500.00 to cover funeral expenses and requirements.</p>
          <p style={P}>The Employee shall provide reasonable proof of death from a recognised government institution or medical professional. Entitlement to Funeral Assistance shall only apply to legally married couples and biological children of the employee, and the employer must be shown details and proof of marriage/relation.</p>
        </div>

        <div style={S}><h3 style={H}>17. COMPASSIONATE LEAVE</h3><p style={P}>In the event of the death of the registered spouse or biological child below 18 years of age, of an employee, Twelve (12) calendar days compassionate leave shall be granted. Any extra days of compassionate leave shall be granted at management's discretion.</p></div>

        <div style={S}><h3 style={H}>18. TAXATION OF EMOLUMENTS</h3><p style={P}>All emoluments under this contract, including pay, commuted leave pay or benefits in kind, will be subject to income tax and any other statutory deductions in accordance with prevailing legislation.</p></div>

        <div style={S}><h3 style={H}>19. EMPLOYEE OBLIGATIONS</h3>
          <p style={P}>The employee shall serve the employer honestly, faithfully and diligently and shall comply with all the rules and regulations of the employer. The Employee will at all times obey all reasonable orders and instructions given by management, and shall duly, honestly and faithfully account for and safeguard their tools, personal possessions and property of the company, at the place of work or during transfer from one location to another.</p>
          <p style={P}>Furthermore:</p>
          <p style={P}>The employee shall act respectfully and attentively in all interactions with customers and clients of the company. Abuse or use of disrespectful language towards customers shall be cause for Disciplinary Action or Summary Dismissal.</p>
          <p style={P}>The employee shall act professionally and be attentive to all duties, at all times during working hours, which includes breaks and lunch times.</p>
          <p style={P}>The employee shall faithfully observe all the rules and regulations laid down from time to time in order to uphold good conduct and discipline for the purpose of effective operations of the company.</p>
          <p style={P}>The employee shall not use or operate a mobile telephone or smartphone while on duty, except in the case of being under the instruction or for communication with management.</p>
          <p style={P}>The employee shall not provide any credit or free services to customers, except under explicit instruction from management. In case the employee provides credit or unpaid service to customers, he/she shall be held responsible for the full amount of the cost of the service and shall be given a written warning.</p>
          <p style={P}>The employee shall always arrive and depart on time, as per their scheduled times of work, Failure to do so, shall lead to THREE (03) written warnings, followed by Summary Dismissal if the employee fails to comply..</p>
          <p style={P}>The employee shall act with absolute honesty and integrity towards customers, fellow employees and management.</p>
          <p style={P}>The employee shall not misuse, misdirect or misappropriate company property, equipment, resources or intellectual property for personal gain.</p>
          <p style={P}>The employee may represent the company for contracting of goods and services or provide customer service only during the course of scheduled normal duties.</p>
          <p style={P}>The employee shall not commence legal proceedings in any courts against the employer, or any of its agents, whilst in the employment of the Company.</p>
          <p style={P}>The employee is obliged to provide periodic reports for management information.</p>
          <p style={P}>The employee shall furnish true and factual information about themselves to the Employer. In the event it is discovered that the employee has withheld or misrepresented any material information, or made false or incorrect statements thereof, the contract shall be declared invalid and the company has the right to terminate the contract of employment at any time without notice.</p>
          <p style={P}>The employee shall not issue any press statements or disclose matters of the company except with express consent of the Directors.</p>
          <p style={P}>The employee shall not remove, or cause the removal or destruction, of any records, papers or documentation of the Company, which may relate to the Company's business, without the explicit written permission of the Company's directors.</p>
          <p style={P}>The employee shall not, at any time, be under the influence of alcohol, narcotics or any other prohibited substance, while on duty or on the Company premises.</p>
        </div>

        <div style={S}><h3 style={H}>20. OTHER EMPLOYMENT</h3><p style={P}>Whilst in the company's employ the employee may NOT be employed by any other employer and may not engage in any other business without obtaining written permission from the Company. The employee may not consult, advise or provide any assistance to any competitor company working in the same or similar industry as the Company. The employee may not disclose or provide information or data of the Company operations to any competitor company, including financial or marketing data. Breach of this clause may lead to prosecution and legal action taken against the Employee.</p></div>

        <div style={S}><h3 style={H}>21. DEDUCTIONS</h3><p style={P}>The employee hereby consents to the deduction and any other off-set against any other monies owed to the employer, or the value estimated of any goods or property of the employer, for which the employee shall be held accountable to the employer and for which he/she may have failed to account for.</p></div>

        <div style={S}><h3 style={H}>22. SUBSISTENCE ALLOWANCE</h3><p style={P}>Where an employee spends a night away from home to attend to the business of the employer, the employee shall be paid a subsistence allowance of ZMW 200 (TWO HUNDRED) per night to cover expenses.</p></div>

        <div style={S}><h3 style={H}>23. ACCIDENT</h3><p style={P}>All accidents must be reported to management immediately by the employee and any failure to do so by an employee will be regarded as gross indiscipline. Appropriate disciplinary action shall be taken.</p></div>

        <div style={S}><h3 style={H}>24. COMPENSATION FOR INJURY WHILE ON DUTY</h3><p style={P}>If any employee sustains injury and suffers partial or permanent disability through an industrial accident, while on duty at the Company premises, the employee shall be compensated under the provisions of the Workers Compensation Fund. Employees and not entitled to compensation and such compensation does NOT apply if the employee was intoxicated, willfully or negligently not following basic safety procedures, or was performing criminal or illegal activity, or was involved in a fight or physical altercation with staff, clients, police or any other member of the public.</p></div>

        <div style={S}><h3 style={H}>25. MISCONDUCT OR BREACH OF CONTRACT</h3><p style={P}>If the Employee commitS any breach of the provisions of this agreement, or shall be guilty of misconduct of any kind, during or outside the business hours, the Employer shall have the right to terminate this agreement and employment of the employee summarily, at any time thereafter. Upon such termination, the Terminal Benefits shall be calculated as Actual pay for Days Worked, up to the date of termination and any accrued paid leave days. The Employee shall be entitled to receive and be paid only the remuneration due up to the date of such termination.</p></div>

        <div style={S}><h3 style={H}>26. CHANGE OF PERSONAL DATA</h3><p style={P}>The Employee shall inform the employer in writing of any change to personal circumstance within ONE (01) month. Failure to do so, shall mean that the information on record at that time shall be utilised and any amendments or adjustments shall be effected after one calendar month following notification.</p></div>

        <div style={S}><h3 style={H}>27. NONDISCLOSURE</h3>
          <p style={P}>(a) Employee understands that, in connection with its engagement with Company, it may receive, produce, or otherwise be exposed to Company's trade secrets, business, proprietary and/or technical information, including, without limitation, information concerning customer lists, customer support strategies, employees, research and development, financial information (including sales, costs, profits, and pricing methods), manufacturing, marketing, proprietary software, hardware, firmware, and related documentation, inventions (whether patentable or not), know-how, show-how, and other information considered to be confidential by Company, and all derivatives, improvements and enhancements to any of the above (including those derivatives, improvements and enhancements that were created or developed by Employee under this Agreement), in addition to all information Company receives from others under an obligation of confidentiality (individually and collectively "Confidential Information").</p>
          <p style={P}>(b) Employee acknowledges that the Confidential Information is the Company's sole, exclusive and extremely valuable property. Accordingly, Employee agrees to segregate all Confidential Information from information of other companies and agrees not to reproduce any Confidential Information without Company's prior written consent, not to use the Confidential Information except in the performance of this Agreement, and not to divulge all or any part of the Confidential Information in any form to any third party, either during or after the term of this Agreement, except to Company employees who need to know such Confidential Information in order to perform their Services. Upon termination or expiration of this Agreement for any reason, Employee agrees to cease using and to return to Company all whole and partial copies and derivatives of the Confidential Information, whether in Employee's possession or under Employee's direct or indirect control, including any computer access nodes and/or codes, and to arrange for the return of such materials by all Employees.</p>
        </div>

        <div style={S}><h3 style={H}>28. DELIVERY OF CORRESPONDENCE</h3><p style={P}>The Employee shall deliver by hand all correspondence under this agreement to management and the employer shall deliver by hand to the employee within his/her department. Failure to deliver due to absence or any other reason, the correspondence will be posted by courier and/or sent via email and by electronic communication to the employee's last known residential address, email address and telephone numbers by electronic communication.</p></div>

        <div style={S}><h3 style={H}>29. DEATH BENEFITS</h3><p style={P}>In case of death of the employee, whilst in the service of the Company, the employer shall pay accrued benefits to the beneficiary, as per letters of administration issued by the courts.</p></div>

        <div style={S}><h3 style={H}>30. REDUNDANCY/TERMINATION</h3><p style={P}>Where an employee's contract of service is terminated by reason of redundancy or other reasons, the employee shall be entitled to at least one month's notice and redundancy benefits of ONE (01) months pay..</p></div>

        <div style={S}><h3 style={H}>31. RIGHT TO SECURITY SCREENINGS</h3><p style={P}>The Employee agrees to the Company having the right search the employee or his/her property, if there is reasonable cause to do so, including viewing of personal correspondence on mobile phones, on entering, leaving and within the Company premises. If an employee is found to be in breach of Company rules, or local laws, as a result of the search, the Company has the right to retain any items or devices which may be used as evidence against the employee, and/or said items may be given over to the Police.</p></div>

        <div style={S}><h3 style={H}>32. LEGAL ACTION</h3><p style={P}>If at any time an employee should instigate legal action, for any reason, against the employer, the employee shall immediately resign. Failure to do so will give the employer the right to terminate the agreement.</p></div>

        <div style={S}><h3 style={H}>33. VALIDATION OF CONTRACT</h3><p style={P}>The contract shall only be deemed as valid and binding, when signed by both Parties.</p></div>

        <div style={S}><h3 style={H}>34. DISCIPLINARY ACTION</h3>
          <p style={P}>The Company may at any time commence disciplinary action against the Employee, if the Employee does not carry out their obligations or due to gross misconduct, and may set any appropriate punishment as deemed necessary, including verbal and written warnings, fines, unpaid suspension from work and demotion to any position that the Company considers suitable, notwithstanding the terms of their position as outlined in this contract.</p>
          <p style={P}>In case the employee is demotion to another position, the current contract shall terminate and a new contract shall be signed between the Parties. The Employee has a right to appeal within 15 days of the decision.</p>
          <p style={P}>Gross misconduct includes, but is not limited to, the following offences:</p>
          <p style={P}>a. Willfully refusing to carry out an instruction given by management, local manager, supervisor, or an appointed representative of company management.<br/>b. Refusing to follow company guidelines.<br/>c. Physically or verbally abusing, acting in a threatening manner towards any member of staff or management. This includes using insulting or threatening language, making fun of a fellow member of staff for any reasons race, religion, tribe, or sex.<br/>d. Theft, fraud or lying to management about performance, financial figures or any other issues.<br/>e. Frequent (more than 3) absence without authorisation from appointed working location or station.<br/>f. Making bets on the Company system or playing games, whether paid for or unpaid, including via 3rd parties, persons, or systems.<br/>g. Repeated financial shortages or unauthorised removal of money from the cash desk.<br/>h. Being under the influence of alcohol, drugs or illegal substances during working hours.<br/>i. Using personal phones or devices without authorisation from management during working times (except during break times).<br/>j. Conducting work for other businesses (either personal or for a 2nd job) during working hours.<br/>k. Working or communicating in any way with competitor betting or casino companies, including providing information regarding company activities or financial data.</p>
        </div>

        <div style={S}><h3 style={H}>35. ACCEPTANCE OF THE TERMS AND CONDITIONS OF SERVICE</h3><p style={P}>These terms and conditions of employment supersede any earlier agreements made between the Parties, either in oral or written form. If these terms and conditions are acceptable to you, please sign in the spaces provided below to signify your unconditional acceptance.</p></div>

        <p style={{...P,fontWeight:"bold",textAlign:"center"}}>IN WITNESS WHEREOF, the parties hereto have executed this Agreement.</p>

        <hr style={{border:"none",borderTop:"2px solid #000",margin:"30px 0"}} />

        <div style={{marginTop:"20px"}}>
          <h3 style={{fontSize:"14px",fontWeight:"bold",marginBottom:"16px",color:"#000"}}>EMPLOYEE SIGNATURE</h3>
            <p style={{fontSize:"12px",color:"#666",marginBottom:"12px"}}>Please draw your signature in the box below and type your full name to confirm.</p>
            <div style={{marginBottom:"16px"}}>
              <label style={{fontSize:"12px",fontWeight:"bold",display:"block",marginBottom:"4px",color:"#000"}}>Full Name</label>
              <input type="text" value={signedName} onChange={e=>setSignedName(e.target.value)} placeholder="Type your full name" style={{width:"100%",padding:"10px",fontSize:"14px",border:"1px solid #ccc",borderRadius:"4px",boxSizing:"border-box",color:"#000"}} />
            </div>
            <div style={{marginBottom:"8px"}}>
              <label style={{fontSize:"12px",fontWeight:"bold",display:"block",marginBottom:"4px",color:"#000"}}>Signature</label>
              <canvas ref={canvasRef} width={600} height={150} onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw} onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw} style={{border:"1px solid #ccc",borderRadius:"4px",width:"100%",height:"120px",cursor:"crosshair",touchAction:"none",background:"#fafafa"}} />
            </div>
            <button onClick={clearSig} style={{fontSize:"11px",color:"#888",background:"none",border:"none",cursor:"pointer",marginBottom:"16px"}}>Clear signature</button>
            <div>
              <button onClick={submitSignature} disabled={signing||!hasDrawn||!signedName.trim()} style={{background:"#1a1a1a",color:"#fff",border:"none",padding:"12px 32px",borderRadius:"4px",fontSize:"14px",fontWeight:"bold",cursor:"pointer",opacity:(signing||!hasDrawn||!signedName.trim())?0.5:1}}>
                {signing?"Submitting...":"Sign Contract"}
              </button>
            </div>
            <p style={{fontSize:"10px",color:"#aaa",marginTop:"16px"}}>By clicking "Sign Contract", you confirm that you have read, understood, and agree to all terms and conditions stated in this employment contract. Your electronic signature is legally binding.</p>
          </div>

        <div style={{textAlign:"center",marginTop:"30px",fontSize:"10px",color:"#aaa"}}>Silverspring Entertainment Ltd | BwanaBet Payroll System</div>
      </div>
    </div>
  );
}
