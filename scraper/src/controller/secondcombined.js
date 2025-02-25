const { default: axios } = require("axios");
const fs = require("fs");
const cheerio = require("cheerio");

const BASEURL = "https://m.rbi.org.in//scripts/";

async function parseRBICirculars(html) {
  const $ = cheerio.load(html);
  const table = $("table.tablebg");
  if (!table.length) return { error: "Table not found" };

  const rows = table.find("tr");
  const title = rows.first().text().trim();
  const headers = [];
  $(rows[1])
    .find("th")
    .each((i, el) => headers.push($(el).text().trim()));

  const circulars = [];
  for (let i = 2; i < rows.length; i++) {
    const rowData = {};
    $(rows[i])
      .find("td")
      .each((j, el) => {
        let value = $(el).text().replace(/\s+/g, " ").trim();
        if (j === 0) {
          const link = $(el).find("a").attr("href");
          if (link) rowData["link"] = BASEURL + link;
        }
        rowData[headers[j]] = value;
      });
    circulars.push(rowData);
  }

  return { title, headers, circulars };
}

async function parseRBICircularDetails(url) {
  try {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    const mainTable = $("table.tablebg");

    // Check if table exists
    if (!mainTable.length) {
      return { error: "Table not found at the specified path" };
    }

    // Extract PDF link if available
    const pdfLink = mainTable.find('a[target="_blank"]').attr("href") || null;

    // Extract circular title
    const title = mainTable.find("td.tableheader b").text().trim();

    // Extract circular number and date
    const circularNumberText = mainTable
      .find('td p:contains("RBI")')
      .first()
      .text()
      .trim();
    const circularNumber = circularNumberText.split("\n")[0].trim();
    const referenceNumber = circularNumberText.split("\n")[1]?.trim() || "";

    // Extract date
    const dateText = mainTable.find('p[align="right"]').first().text().trim();

    // Extract meant for (addressee)
    const meantFor = mainTable
      .find('td p:contains("Madam")')
      .prev()
      .text()
      .trim();

    // Extract content sections
    const contentSections = [];
    mainTable.find("p.head").each((index, element) => {
      const sectionTitle = $(element).text().trim();
      let sectionContent = "";

      // Get all text until the next heading or end
      let nextElement = $(element).next();
      while (nextElement.length && !nextElement.hasClass("head")) {
        // If it's a paragraph, add its text
        if (nextElement.prop("tagName") === "P") {
          sectionContent += nextElement.text().trim() + "\n\n";
        }
        // If it's a table, try to extract it as well
        else if (nextElement.prop("tagName") === "TABLE") {
          sectionContent += "Table content (embedded table)\n\n";
        }

        nextElement = nextElement.next();
      }

      contentSections.push({
        title: sectionTitle,
        content: sectionContent.trim(),
      });
    });

    // Extract tables within the document
    const tables = [];
    mainTable.find("table.tablebg").each((index, element) => {
      if (index > 0) {
        // Skip the main outer table
        const tableTitle =
          $(element).prev("p.head").text().trim() ||
          $(element).find("tr.head td").first().text().trim() ||
          "Unnamed Table";

        const tableData = [];
        const headers = [];

        // Extract headers from the first row with 'head' class
        $(element)
          .find("tr.head")
          .first()
          .find("td")
          .each((i, el) => {
            headers.push($(el).text().trim());
          });

        // Extract rows (skip the header row)
        $(element)
          .find("tr")
          .not(".head")
          .each((rowIndex, row) => {
            const rowData = {};
            $(row)
              .find("td")
              .each((colIndex, col) => {
                if (headers.length > colIndex) {
                  rowData[headers[colIndex]] = $(col).text().trim();
                } else {
                  rowData[`Column${colIndex + 1}`] = $(col).text().trim();
                }
              });

            // Only add row if it has data
            if (Object.keys(rowData).length > 0) {
              tableData.push(rowData);
            }
          });

        tables.push({
          title: tableTitle,
          headers: headers,
          data: tableData,
        });
      }
    });

    // Create the final JSON structure
    return {
      circular: {
        title: title,
        circularNumber: circularNumber,
        referenceNumber: referenceNumber,
        date: dateText,
        meantFor: meantFor,
        pdfLink: pdfLink,
        contentSections: contentSections,
        tables: tables,
      },
    };
  } catch (error) {
    return { error: error.message };
  }
}

async function extractCircularsData() {
  try {
    const url = "https://m.rbi.org.in/scripts/BS_CircularIndexDisplay.aspx"; // Double slash corrected to single

    // Define the headers
    const headers = {
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
      "Cache-Control": "max-age=0",
      Connection: "keep-alive",
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie:
        "f5_cspm=1234; ASP.NET_SessionId=r0y0b3oldyc3i13mnjzvrbgk; IncPath=Includes1; BIGipServerPool-RBI-website=84939948.20480.0000; TSa07da9d1029=0874148b5fab28004c6a755e5c4a54801c4ddc10a5a86ccb7d8e2e43ba7f960b82809f7af14f9635523be6cf8b82dbfb; TS0194b248=01af0247249f11cc4e470c93a648e0e84c8080f16862c31781d5df191789c503b7fcfd52e2ffdcb98f5c7fdf1ebb7f053be4af7a0b9c505a2d77cb044adedc1f55f5235b4eab8a41c8730fcccba914f07ea350c8a76d47ffa4526f31adb5f049e3c9ce581fe14688121bf3b5a94792ef7a0a4192456d5a8621eaaf45f64d3419f30c4db0f5; TSPD_101=0874148b5fab2800f1d0e5bda78c7106c8a4f405c521626528bb4289b38d3ea7b7cb27358e8102e62005d6f4e5648aa3087a7658c9051800cbed9a13e7eecc2d66391300c0a44f695e9efe18e89a4286; TS71c5c044027=0874148b5fab2000fc7c1b5e132472aea0a93da91524e62e9370184d4c2990158c6abad83cc7d48008ea7b4c781130000e9f01838adac2792612c4125a51af3da3765c3e530207899e62e38bccab302624f252f7ae18d06d3db104c327cb58b8; TSa07da9d1077=0874148b5fab2800677deaa36c211d68bdff4459dad9da665aee15094a2f3a29d44e7f43dee99b63fdf6eaf62ab500e50891d93cd817200050a4da37785f59193eeb5d9caf2919ac955c54477f24e7ed7e1879c759729884",
      Origin: "https://m.rbi.org.in",
      Referer: "https://m.rbi.org.in/scripts/BS_CircularIndexDisplay.aspx",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "same-origin",
      "Sec-Fetch-User": "?1",
      "Sec-GPC": "1",
      "Upgrade-Insecure-Requests": "1",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
      "sec-ch-ua": '"Not(A:Brand";v="99", "Brave";v="133", "Chromium";v="133"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
    };

    // Define the form data
    const data = {
      __EVENTTARGET: "",
      __EVENTARGUMENT: "",
      __VIEWSTATE:
        "/wEPDwUKLTM3MjczMTEyNmRk3YG45ph54J7xZbHva0KYRkGPDii0073tDJ1kXan2qRY=",
      __VIEWSTATEGENERATOR: "D6E3A03A",
      __EVENTVALIDATION:
        "/wEdAAsB9z46FtsD+z1j2cnKU7YBlK+XrsQEVyjeDxQ0A4GYXFBwzdjZXczwplb2HKGyLlqLrBfuDtX7nV3nL+5njT0xZDpy7WJnvc3tgXY08CYLJD+rfdwJAuBoVBISURIXWlx9xf1loRXvygROM/A1O+NHJounKCGGAHd04zzVhBPZz6p1BqmEh36xZqarLufpnih6X6fuM2viwD7WaeSucgPE3Qu9eL+WAyV5OXsFYvneT+pdA36mjV5eh4NB+XRlMAJ9PW/30stjZHKvAcQQbBi9",
      hdnYear: "2024",
      hdnMonth: "0",
      UsrFontCntr$txtSearch: "",
      UsrFontCntr$btn: "",
    };

    // Make the Axios POST request

    const pageData = await axios.post(
      url,
      new URLSearchParams(data).toString(),
      { headers }
    );
    const result = await parseRBICirculars(pageData.data);

    for (let circular of result.circulars) {
      if (circular.link) {
        const details = await parseRBICircularDetails(circular.link);
        circular.details = details;
      }
    }

    fs.writeFileSync("rbi_circulars2.json", JSON.stringify(result, null, 2));
    console.log(result);
  } catch (error) {
    console.error("Error:", error.message);
  }
}

extractCircularsData();
