<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:sm="http://www.sitemaps.org/schemas/sitemap/0.9"
  exclude-result-prefixes="sm">

  <xsl:output method="html" encoding="UTF-8" indent="yes" />

  <xsl:template match="/">
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Sitemap — Oklahoma Blood Institute</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: system-ui, -apple-system, sans-serif;
            background-color: #ffffff;
            color: #1f2937;
            line-height: 1.6;
            padding: 2rem;
          }

          .container {
            max-width: 1200px;
            margin: 0 auto;
          }

          header {
            margin-bottom: 2rem;
            border-bottom: 3px solid #b91c1c;
            padding-bottom: 1.5rem;
          }

          h1 {
            font-size: 2.5rem;
            color: #1f2937;
            margin-bottom: 0.5rem;
            font-weight: 700;
          }

          .subtitle {
            font-size: 1rem;
            color: #6b7280;
            margin-top: 0.5rem;
          }

          .stats {
            display: flex;
            gap: 2rem;
            margin-top: 1.5rem;
            flex-wrap: wrap;
          }

          .stat-box {
            background-color: #f9fafb;
            padding: 1rem 1.5rem;
            border-radius: 0.5rem;
            border-left: 4px solid #b91c1c;
          }

          .stat-label {
            font-size: 0.875rem;
            color: #6b7280;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }

          .stat-value {
            font-size: 1.875rem;
            color: #b91c1c;
            font-weight: 700;
            margin-top: 0.25rem;
          }

          .table-wrapper {
            overflow-x: auto;
            margin-top: 2rem;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            background-color: #ffffff;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            border-radius: 0.5rem;
            overflow: hidden;
          }

          thead {
            background-color: #b91c1c;
          }

          th {
            color: #ffffff;
            padding: 1rem 1.25rem;
            text-align: left;
            font-weight: 600;
            font-size: 0.95rem;
            letter-spacing: 0.05em;
            cursor: pointer;
            user-select: none;
            white-space: nowrap;
          }

          th:hover {
            background-color: #991919;
          }

          th::after {
            content: " ⇅";
            font-size: 0.75rem;
            opacity: 0.5;
            margin-left: 0.25rem;
          }

          tbody tr {
            border-bottom: 1px solid #e5e7eb;
            transition: background-color 0.2s ease;
          }

          tbody tr:hover {
            background-color: #f9fafb;
          }

          tbody tr:last-child {
            border-bottom: none;
          }

          td {
            padding: 1rem 1.25rem;
            font-size: 0.95rem;
          }

          a {
            color: #b91c1c;
            text-decoration: none;
            word-break: break-word;
            transition: color 0.2s ease;
          }

          a:hover {
            color: #991919;
            text-decoration: underline;
          }

          .date {
            color: #6b7280;
            font-family: 'Monaco', 'Menlo', monospace;
            font-size: 0.9rem;
          }

          .frequency {
            text-transform: capitalize;
            font-weight: 500;
            color: #374151;
          }

          .priority {
            font-weight: 600;
            color: #374151;
          }

          .empty-state {
            text-align: center;
            padding: 3rem 2rem;
            color: #6b7280;
          }

          .empty-state p {
            font-size: 1.1rem;
          }

          footer {
            margin-top: 3rem;
            padding-top: 2rem;
            border-top: 1px solid #e5e7eb;
            font-size: 0.875rem;
            color: #6b7280;
            text-align: center;
          }

          @media (max-width: 768px) {
            body {
              padding: 1rem;
            }

            h1 {
              font-size: 1.875rem;
            }

            .stats {
              gap: 1rem;
            }

            th, td {
              padding: 0.75rem;
              font-size: 0.85rem;
            }

            .table-wrapper {
              margin-top: 1.5rem;
            }
          }

          @media (max-width: 480px) {
            body {
              padding: 0.75rem;
            }

            h1 {
              font-size: 1.5rem;
            }

            .stats {
              flex-direction: column;
              gap: 0.75rem;
            }

            th, td {
              padding: 0.5rem 0.75rem;
              font-size: 0.8rem;
            }

            a {
              word-break: break-all;
            }
          }
        </style>
        <script>
          function sortTable(columnIndex) {
            const table = document.querySelector('table tbody');
            const rows = Array.from(table.querySelectorAll('tr'));

            if (rows.length === 0) return;

            const isAscending = table.dataset.sortColumn === String(columnIndex) &&
                               table.dataset.sortOrder === 'asc';

            rows.sort((a, b) => {
              let aValue = a.cells[columnIndex].textContent.trim();
              let bValue = b.cells[columnIndex].textContent.trim();

              // Try numeric comparison for priority column
              if (columnIndex === 3) {
                const aNum = parseFloat(aValue);
                const bNum = parseFloat(bValue);
                if (!isNaN(aNum) && !isNaN(bNum)) {
                  return isAscending ? bNum - aNum : aNum - bNum;
                }
              }

              // String comparison for other columns
              const comparison = aValue.localeCompare(bValue);
              return isAscending ? -comparison : comparison;
            });

            rows.forEach(row => table.appendChild(row));

            table.dataset.sortColumn = columnIndex;
            table.dataset.sortOrder = isAscending ? 'desc' : 'asc';
          }

          document.addEventListener('DOMContentLoaded', function() {
            const headers = document.querySelectorAll('th');
            headers.forEach((header, index) => {
              header.addEventListener('click', () => sortTable(index));
            });
          });
        </script>
      </head>
      <body>
        <div class="container">
          <header>
            <h1>Sitemap</h1>
            <p class="subtitle">Oklahoma Blood Institute</p>
            <div class="stats">
              <div class="stat-box">
                <div class="stat-label">Total URLs</div>
                <div class="stat-value">
                  <xsl:value-of select="count(//sm:url | //url)" />
                </div>
              </div>
            </div>
          </header>

          <div class="table-wrapper">
            <xsl:choose>
              <xsl:when test="count(//sm:url | //url) > 0">
                <table>
                  <thead>
                    <tr>
                      <th>URL</th>
                      <th>Last Modified</th>
                      <th>Change Frequency</th>
                      <th>Priority</th>
                    </tr>
                  </thead>
                  <tbody>
                    <xsl:apply-templates select="//sm:url | //url" />
                  </tbody>
                </table>
              </xsl:when>
              <xsl:otherwise>
                <div class="empty-state">
                  <p>No URLs found in this sitemap.</p>
                </div>
              </xsl:otherwise>
            </xsl:choose>
          </div>

          <footer>
            <p>This sitemap was automatically generated and formatted for easy browsing.</p>
          </footer>
        </div>
      </body>
    </html>
  </xsl:template>

  <xsl:template match="sm:url | url">
    <tr>
      <td>
        <a>
          <xsl:attribute name="href">
            <xsl:value-of select="sm:loc | loc" />
          </xsl:attribute>
          <xsl:value-of select="sm:loc | loc" />
        </a>
      </td>
      <td>
        <xsl:choose>
          <xsl:when test="sm:lastmod | lastmod">
            <span class="date">
              <xsl:value-of select="sm:lastmod | lastmod" />
            </span>
          </xsl:when>
          <xsl:otherwise>
            <span class="date">—</span>
          </xsl:otherwise>
        </xsl:choose>
      </td>
      <td>
        <xsl:choose>
          <xsl:when test="sm:changefreq | changefreq">
            <span class="frequency">
              <xsl:value-of select="sm:changefreq | changefreq" />
            </span>
          </xsl:when>
          <xsl:otherwise>
            <span class="frequency">—</span>
          </xsl:otherwise>
        </xsl:choose>
      </td>
      <td>
        <xsl:choose>
          <xsl:when test="sm:priority | priority">
            <span class="priority">
              <xsl:value-of select="sm:priority | priority" />
            </span>
          </xsl:when>
          <xsl:otherwise>
            <span class="priority">—</span>
          </xsl:otherwise>
        </xsl:choose>
      </td>
    </tr>
  </xsl:template>

</xsl:stylesheet>