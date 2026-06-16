import { useEffect, useState } from "react"
import supabase from "../config/SupabaseClient"
import WarehouseMap from '../components/WarehouseMap';
import EmptyState from '../components/EmptyState';
import { Warehouse as WarehouseIcon, RefreshCw } from 'lucide-react';

const Warehouse = () => {
    const [fetchError, setFetchError] = useState(null)
    const [warehouseData, setWarehouseData] = useState(null)

    useEffect(() => {
        const fetchWarehouses = async () => {
            const { data, error } = await supabase
                .from('warehouse')
                .select()

            if (error) {
                setFetchError(true)
                setWarehouseData(null)
                console.log(error)
            }

            if (data) {
                setWarehouseData(data)
                setFetchError(null)
            }
        }

        fetchWarehouses()
    }, [])

    return (
        <div className="page warehouse">
            <div className="warehouse-title" style={{ marginBottom: '30px' }}>
                <h2>Warehouse Facilities</h2>
                <p>Manage and monitor real-time inventory and distribution centers.</p>
            </div>

            <div style={{ marginTop: '20px' }}>
                <WarehouseMap />
            </div>




            {fetchError && (
                <EmptyState
                    icon={RefreshCw}
                    title="Data Temporarily Unavailable"
                    message="We couldn't load warehouse data right now. Please refresh to try again."
                    variant="warning"
                    size="md"
                />
            )}

            {warehouseData && warehouseData.length === 0 && (
                <EmptyState
                    icon={WarehouseIcon}
                    title="Warehouse Ready"
                    message="Inventory records will appear here as stock arrives."
                    size="lg"
                    style={{ minHeight: '240px' }}
                />
            )}

            {warehouseData && warehouseData.length > 0 && (
                <div className="warehouse-list">
                    {warehouseData.map((wh) => (
                        <div key={wh.warehouse_id} className="warehouse-card">

                            <div className="warehouse-header">
                                <div className="warehouse-header-left">
                                    <div className="warehouse-icon">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"></path><path d="M5 21V7l8-4 8 4v14"></path><path d="M9 21v-6h6v6"></path></svg>
                                    </div>
                                    <h3>{wh.warehouse_name}</h3>
                                </div>
                                <span className="warehouse-header-badge">ID: {wh.warehouse_id}</span>
                            </div>

                            <div className="warehouse-details">

                                <div className="detail-item full-width">
                                    <span className="detail-label">ADDRESS</span>
                                    <span className="detail-value">{wh.address}</span>
                                </div>

                                <div className="detail-item stat-inbound">
                                    <span className="detail-label">INBOUND</span>
                                    <span className="detail-value">{wh.inbound}</span>
                                </div>

                                <div className="detail-item stat-outbound">
                                    <span className="detail-label">OUTBOUND</span>
                                    <span className="detail-value">{wh.outbound}</span>
                                </div>

                                <div className="detail-item stat-onhand">
                                    <span className="detail-label">ON HAND</span>
                                    <span className="detail-value">{wh.onhand}</span>
                                </div>

                            </div>

                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

export default Warehouse