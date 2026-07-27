type TableProps = {
  headers: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Array<Record<string, any>>;
};

export default function Table({ headers, data }: TableProps) {
  return (
    <div className="bg-card rounded-xl shadow overflow-x-auto">
      <table className="w-full">
        <thead className="bg-muted">
          <tr>
            {headers.map((header) => (
              <th
                key={header}
                className="text-left p-4 font-semibold text-foreground"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={headers.length}
                className="p-4 text-center text-muted-foreground"
              >
                Sin registros
              </td>
            </tr>
          ) : (
            data.map((row, index) => (
              <tr key={index} className="border-t hover:bg-gray-50">
                {Object.values(row).map((value, i) => (
                  <td key={i} className="p-4">
                    {value}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}