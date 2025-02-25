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
    const pageData = await axios.get(
      "https://m.rbi.org.in//scripts/BS_CircularIndexDisplay.aspx"
    );
    const result = await parseRBICirculars(pageData.data);

    for (let circular of result.circulars) {
      if (circular.link) {
        const details = await parseRBICircularDetails(circular.link);
        circular.details = details;
      }
    }

    fs.writeFileSync("rbi_circulars.json", JSON.stringify(result, null, 2));
    console.log(result);
  } catch (error) {
    console.error("Error:", error.message);
  }
}

extractCircularsData();
