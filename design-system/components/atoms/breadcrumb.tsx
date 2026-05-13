import { Breadcrumbs, Link } from "@mui/material"

export type BreadcrumbsDetails = {
    label: string
    url: string
    color: string
}

interface IBreadcrumbsComponent {
    links: BreadcrumbsDetails[]
}
export const BreadcrumbsComponent = (props: IBreadcrumbsComponent) => {

    const { links } = props
    return (
        <Breadcrumbs aria-label="breadcrumb">
            {
                links && links.map((item, index) => {
                    return (
                        <Link
                            key={`breadcrumbs-link-${index}`}
                            underline="hover"
                            color={item.color}
                            href={item.url}
                        >
                            {item.label}
                        </Link>
                    )
                })
            }
        </Breadcrumbs>
    )
}